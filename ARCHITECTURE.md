# ARCHITECTURE.md — WebCheck

## システム構成図

```
┌──────────────────────────────────────────────────────────┐
│                      Next.js App                          │
│                                                           │
│  ┌─────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │ URL入力  │→│ /api/check │→│   checker-runner.ts   │  │
│  └─────────┘  └────────────┘  │                      │  │
│                                │  ┌─ meta.ts ────────┐│  │
│  ┌─────────┐                   │  ├─ images.ts ──────┤│  │
│  │結果表示  │←─ CheckReport ──│  ├─ links.ts ───────┤│  │
│  └─────────┘                   │  ├─ a11y.ts ────────┤│  │
│                                │  ├─ performance.ts ─┤│  │
│  ┌─────────┐  ┌────────────┐  │  └─ text.ts ────────┘│  │
│  │FB選択   │→│ /api/export │  └──────────────────────┘  │
│  └─────────┘  └────────────┘                             │
│       ↓                          ┌─────────────────┐     │
│  Markdown出力                     │  page-fetcher   │     │
│                                   │  (Playwright)   │     │
│                                   └─────────────────┘     │
│                                   ┌─────────────────┐     │
│                                   │    llm.ts       │     │
│                                   │  (Claude API)   │     │
│                                   └─────────────────┘     │
│                                   ┌─────────────────┐     │
│                                   │    db.ts        │     │
│                                   │   (SQLite)      │     │
│                                   └─────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

## チェッカー詳細仕様

### 共通インターフェース

```typescript
import { CheerioAPI } from 'cheerio'

/**
 * 全チェッカーが準拠するインターフェース
 * DOMとURLを受け取り、CheckResult配列を返す
 */
type Checker = (dom: CheerioAPI, url: string) => Promise<CheckResult[]>
```

axe-core と Lighthouse は Playwright の Page オブジェクトも必要なため、
拡張インターフェースを使用する：

```typescript
import { Page } from 'playwright'

type BrowserChecker = (
  dom: CheerioAPI,
  url: string,
  page: Page
) => Promise<CheckResult[]>
```

---

### meta.ts — メタ情報チェッカー

**LLM不要。完全ルールベース。**

| チェック項目 | 判定ルール | 深刻度 |
|-------------|-----------|--------|
| title タグ有無 | 存在しない → critical | critical |
| title 文字数 | <10 or >60 → warning | warning |
| meta description 有無 | 存在しない → warning | warning |
| meta description 文字数 | <50 or >160 → info | info |
| og:title | 存在しない → warning | warning |
| og:description | 存在しない → warning | warning |
| og:image | 存在しない → critical | critical |
| og:url | 存在しない → info | info |
| twitter:card | 存在しない → info | info |
| canonical URL | 存在しない → warning | warning |
| canonical が自己参照か | URL不一致 → warning | warning |
| favicon | link[rel="icon"] 無し → warning | warning |
| html lang属性 | 存在しない → warning | warning |
| viewport meta | 存在しない → critical | critical |
| charset | 存在しない or utf-8以外 → info | info |

**location**: すべて `<head>` を返す。
**currentValue**: 存在する場合はその値、無い場合は `null`。

---

### images.ts — 画像・altチェッカー

**LLM使用: alt品質判定のみ（任意。Phase 1ではルールベースのみでも可）**

| チェック項目 | 判定ルール | 深刻度 |
|-------------|-----------|--------|
| alt属性なし | img[alt] が存在しない | critical |
| alt="" (空) | alt="" の画像一覧 | warning |
| alt が "画像" "image" 等の汎用テキスト | 正規表現マッチ | warning |
| alt が過度に長い | >125文字 | info |
| 装飾画像の判定 | role="presentation" or aria-hidden="true" なら pass | pass |

**location**: `img` 要素のCSSセレクタ（`section.hero > img:nth-child(2)` 等）

CSSセレクタの生成ロジック：
```typescript
/**
 * DOM要素からユニークなCSSセレクタを生成する
 * 優先順位: #id > .class組み合わせ > nth-child
 */
function generateSelector(element: CheerioElement): string
```

---

### links.ts — リンクチェッカー

**LLM不要。HTTP HEADリクエストベース。**

| チェック項目 | 判定ルール | 深刻度 |
|-------------|-----------|--------|
| 404リンク | HEAD → 404 | critical |
| 5xxリンク | HEAD → 5xx | critical |
| リダイレクトリンク | HEAD → 301/302 | info |
| タイムアウト | 10秒以内に応答なし | warning |
| アンカーテキスト「こちら」「ここ」 | テキストマッチ | warning |
| mailto: / tel: のフォーマット | 正規表現 | info |
| 空href | href="" or href="#" | warning |

**並列制御**: `Promise.allSettled` + 同時実行数5（p-limit使用）

```typescript
import pLimit from 'p-limit'
const limit = pLimit(5)

const results = await Promise.allSettled(
  links.map(link => limit(() => checkLink(link)))
)
```

**最大チェック数**: 1ページあたり100リンクまで。超過分はinfoとして報告。

---

### a11y.ts — アクセシビリティチェッカー

**axe-coreの結果をCheckResult形式に変換する。**

```typescript
import AxeBuilder from '@axe-core/playwright'

async function checkA11y(dom: CheerioAPI, url: string, page: Page) {
  const axeResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
    .analyze()

  return axeResults.violations.map(violation => ({
    // axeの impact を severity にマッピング
    severity: mapImpact(violation.impact),  // critical/serious → critical, moderate → warning, minor → info
    title: violation.help,
    location: violation.nodes[0]?.target?.join(' > ') ?? 'unknown',
    recommendation: violation.helpUrl,
    // ...
  }))
}
```

---

### performance.ts — パフォーマンスチェッカー

**Lighthouse Node APIを使用。**

```typescript
import lighthouse from 'lighthouse'
import { launch } from 'chrome-launcher'

// Lighthouse はPlaywrightとは別にChrome起動が必要
// Phase 1 では chromeLauncher を使用する
```

| チェック項目 | 閾値 | 深刻度 |
|-------------|------|--------|
| Performance スコア | <50 → critical, <90 → warning | variable |
| Accessibility スコア | <50 → critical, <90 → warning | variable |
| Best Practices スコア | <50 → critical, <90 → warning | variable |
| SEO スコア | <50 → critical, <90 → warning | variable |
| LCP | >4s → critical, >2.5s → warning | variable |
| CLS | >0.25 → critical, >0.1 → warning | variable |
| FID / INP | >500ms → critical, >200ms → warning | variable |

**locationHuman**: 「Lighthouse総合スコア」「Core Web Vitals」等のセクション名。

---

### text.ts — テキスト・表記チェッカー

**LLM使用: 誤字・表記ゆれの判定。**

処理フロー:
1. DOM からテキストノードを抽出（`body` 内、`script`/`style` 除外）
2. テキストをセクション単位に分割（見出しタグで区切り）
3. 各セクションをLLMに送信し、誤字・表記ゆれを検出

LLMプロンプト:
```
以下のWebページのテキストを検査してください。
検出対象:
- 誤字・脱字
- 表記ゆれ（例：「お問い合わせ」と「お問合せ」の混在）
- 不自然な日本語
- ©表記の年号（現在は2026年）

テキストのセクション名: {sectionName}
テキスト内容:
{text}

JSON形式で回答してください:
[{ "issue": "説明", "location": "該当テキスト", "suggestion": "修正案" }]
問題がなければ空配列 [] を返してください。
```

**コスト制御**: テキスト量が多い場合、最初の5セクション（約5000文字）までに制限。超過分はinfoとして「未検査セクションあり」と報告。

---

## DB スキーマ

```sql
-- db/schema.sql

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  checked_at TEXT NOT NULL,      -- ISO 8601
  summary_json TEXT NOT NULL,    -- JSON: { critical, warning, info, pass, total }
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id),
  category TEXT NOT NULL,         -- meta | images | links | a11y | performance | text
  severity TEXT NOT NULL,         -- critical | warning | info | pass
  title TEXT NOT NULL,
  location TEXT,                  -- CSSセレクタ
  location_human TEXT,            -- 人間向け場所表記
  current_value TEXT,
  recommendation TEXT,
  code_example TEXT,
  status TEXT DEFAULT 'open',     -- open | fb_sent | fixed
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_results_report ON results(report_id);
CREATE INDEX idx_results_category ON results(category);
CREATE INDEX idx_results_severity ON results(severity);
```

## Markdown FB出力フォーマット

```typescript
// lib/markdown-export.ts

function generateFBMarkdown(report: CheckReport, selectedIds: string[]): string {
  const selected = report.results.filter(r => selectedIds.includes(r.id))
  const grouped = groupBySeverity(selected) // critical → warning → info の順

  let md = `## WebCheck レポート: ${report.url}\n`
  md += `チェック日時: ${formatDate(report.checkedAt)}\n`
  md += `対象: ${selected.length}件\n\n`

  for (const [severity, items] of Object.entries(grouped)) {
    md += `### ${severityEmoji(severity)} ${severityLabel(severity)}\n\n`
    items.forEach((item, i) => {
      md += `#### ${i + 1}. ${item.title}\n`
      md += `- カテゴリ: ${categoryLabel(item.category)}\n`
      md += `- 場所: \`${item.location}\`\n`
      if (item.currentValue) md += `- 現状: ${item.currentValue}\n`
      md += `- 推奨: ${item.recommendation}\n`
      if (item.codeExample) md += `- コード例:\n\`\`\`html\n${item.codeExample}\n\`\`\`\n`
      md += '\n'
    })
  }
  return md
}
```

## エラーハンドリング方針

| エラー種別 | 対応 |
|-----------|------|
| URL接続不可 | ユーザーに「URLにアクセスできません」表示。チェック中断 |
| Playwright タイムアウト | 30秒でタイムアウト。「ページの読み込みに時間がかかっています」表示 |
| axe-core 実行失敗 | a11yカテゴリのみスキップ。他カテゴリは続行 |
| Lighthouse 実行失敗 | performanceカテゴリのみスキップ。他カテゴリは続行 |
| LLM API エラー | LLM依存項目のみスキップ（alt品質、テキスト検査）。ルールベース項目は続行 |
| リンクチェック部分失敗 | タイムアウトしたリンクは warning として報告。他は続行 |

**原則: 1つのチェッカーの失敗が他のチェッカーに影響しない。**
`Promise.allSettled` を使用し、各チェッカーの結果を独立に収集する。

## セキュリティ考慮

- 入力URLのバリデーション: プロトコルは http/https のみ許可
- プライベートIP（127.0.0.1, 10.x, 192.168.x 等）へのリクエストをブロック（SSRF防止）
- Playwright は `--no-sandbox` で実行しない
- LLM に送信するテキストに個人情報が含まれる可能性 → Phase 1 では注意喚起のみ。Phase 2 以降でPIIフィルタリング検討
