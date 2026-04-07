# WebCheck 製品仕様書 v1.0

> Webディレクターのための検収自動化ツール
> 作成日: 2026-04-07
> ステータス: Phase 1 実装中

---

## 1. 製品概要

### 1.1 コンセプト
URLを入力すると、Webディレクターが手作業で行っている検収チェック（メタ情報・画像alt・リンク・アクセシビリティ・パフォーマンス・テキスト品質）を自動実行し、エンジニアへのFB（フィードバック）をMarkdownで出力するツール。

### 1.2 解決する課題
現状のWebディレクターの検収ワークフローには以下の問題がある：

| 課題 | 詳細 |
|------|------|
| 場所の特定コストが高い | 「トップページの3つ目のセクションの右カラムの…」という説明が必要 |
| スクショと説明の紐付けが切れる | 別ファイル・別シートに分散 |
| 優先度が不明 | 全項目が並列で、エンジニアが何から直すべきかわからない |
| 修正確認の追跡ができない | 直ったかどうかを再度目視確認する必要がある |
| 共有先がバラバラ | Slack、Backlog、スプレッドシート、メール…チームによって異なる |

### 1.3 製品の価値提案
- **チェックとFB作成がワンフロー** — 別ツールにコピペする手間をゼロにする
- **エンジニアが即座に修正可能** — 場所（CSSセレクタ）＋現状＋推奨対応の3点セットで1項目完結
- **再チェックで修正確認を自動化** — FB→修正→確認のサイクル全体をカバー

### 1.4 競合・既存ツールとの差別化

| ツール | できること | WebCheckとの違い |
|--------|-----------|-----------------|
| Pixelay | Figmaデザインとウェブページの画像オーバーレイ比較 | 視覚的差分は出るが「何が問題か」のレポート生成はしない |
| inspecta | Figma要素のCSSとWeb要素のCSS比較 | デザイン差分特化、コード品質・メタタグ等はカバーしない |
| Lighthouse | パフォーマンス・a11y・SEOスコア | レポート止まり。FBワークフローとの統合なし |
| axe DevTools | アクセシビリティ自動チェック | a11y特化。他カテゴリは対象外 |
| Gumloop（Mediumプロトタイプ） | LLMで画像分析→差分レポート | 精度・実用性ともに未検証段階 |

**WebCheckの独自性**: 上記ツールが個別にカバーする領域を、Webディレクターの検収業務に最適化した形で統合し、FB作成・共有・修正追跡まで一気通貫で行える点。

---

## 2. ターゲットユーザー

### 2.1 プライマリ
- Webディレクター（制作会社・事業会社）
- サイト公開前の検収チェックを担当する人

### 2.2 セカンダリ
- QAエンジニア（自動チェックの効率化）
- フロントエンドエンジニア（セルフチェック用途）

---

## 3. Phase定義とロードマップ

### Phase 1（MVP）— 現在のスコープ
- URLを入力 → 6カテゴリの自動チェック → 結果表示
- FB選択 → Markdownエクスポート
- SQLiteによるレポート保存
- 再チェック機能（前回結果との差分表示）
- **Figma連携なし、スクリーンショットなし**
- **FB出力はMarkdownのみ**（テキストベースで機能検証）

### Phase 1.5
- スクリーンショット + 該当箇所ハイライト（Playwright要素座標 → 赤枠描画）
- CSV / スプレッドシートエクスポート
- 共有リンク生成（レポートの固定URL）

### Phase 2
- Figma API連携（テキスト差分：Figmaテキストノード ↔ 実装テキスト）
- Figmaデザインとの画像比較（LLM Vision判定、精度70〜80%見込み）

### Phase 3
- マルチページ一括チェック
- チーム機能（複数ユーザー、権限管理）
- Slack / Backlog 連携（FB送信先としての直接統合）

---

## 4. 機能仕様

### 4.1 入力
- URL（1つ）。http / https のみ許可
- プライベートIP（127.0.0.1, 10.x, 192.168.x等）はブロック（SSRF防止）

### 4.2 チェック項目（6カテゴリ）

#### ① メタ情報チェック（meta.ts）
LLM不要。完全ルールベース。

| チェック項目 | 判定ルール | 深刻度 |
|-------------|-----------|--------|
| title タグ有無 | 存在しない | critical |
| title 文字数 | <10 or >60 | warning |
| meta description 有無 | 存在しない | warning |
| meta description 文字数 | <50 or >160 | info |
| og:title | 存在しない | warning |
| og:description | 存在しない | warning |
| og:image | 存在しない | critical |
| og:url | 存在しない | info |
| twitter:card | 存在しない | info |
| canonical URL | 存在しない | warning |
| canonical 自己参照 | URL不一致 | warning |
| favicon | link[rel="icon"] 無し | warning |
| html lang属性 | 存在しない | warning |
| viewport meta | 存在しない | critical |
| charset | 存在しない or utf-8以外 | info |

#### ② 画像・altチェック（images.ts）
LLM使用：alt品質判定のみ（Phase 1ではルールベースのみでも可）

| チェック項目 | 判定ルール | 深刻度 |
|-------------|-----------|--------|
| alt属性なし | img[alt] が存在しない | critical |
| alt="" (空) | alt="" の画像一覧 | warning |
| alt が汎用テキスト | 「画像」「image」等に正規表現マッチ | warning |
| alt が過度に長い | >125文字 | info |
| 装飾画像の判定 | role="presentation" or aria-hidden="true" | pass |

#### ③ リンクチェック（links.ts）
LLM不要。HTTP HEADリクエストベース。並列5、最大100リンク。

| チェック項目 | 判定ルール | 深刻度 |
|-------------|-----------|--------|
| 404リンク | HEAD → 404 | critical |
| 5xxリンク | HEAD → 5xx | critical |
| リダイレクトリンク | HEAD → 301/302 | info |
| タイムアウト | 10秒以内に応答なし | warning |
| アンカーテキスト「こちら」「ここ」 | テキストマッチ | warning |
| mailto: / tel: フォーマット | 正規表現 | info |
| 空href | href="" or href="#" | warning |

#### ④ アクセシビリティチェック（a11y.ts）
axe-coreの結果をCheckResult形式に変換。WCAG 2.1 AA基準。

- axeの `impact` → severity マッピング: critical/serious → critical, moderate → warning, minor → info

#### ⑤ パフォーマンスチェック（performance.ts）
Lighthouse Node API使用。

| チェック項目 | 閾値 | 深刻度 |
|-------------|------|--------|
| Performance スコア | <50 → critical, <90 → warning | variable |
| Accessibility スコア | <50 → critical, <90 → warning | variable |
| Best Practices スコア | <50 → critical, <90 → warning | variable |
| SEO スコア | <50 → critical, <90 → warning | variable |
| LCP | >4s → critical, >2.5s → warning | variable |
| CLS | >0.25 → critical, >0.1 → warning | variable |
| FID / INP | >500ms → critical, >200ms → warning | variable |

#### ⑥ テキスト・表記チェック（text.ts）
LLM使用。テキスト抽出 → Claude Sonnetで誤字・表記ゆれ判定。

- テキストをセクション単位に分割（見出しタグで区切り）
- 最初の5セクション（約5000文字）まで。超過分はinfo報告
- 1チェック実行あたりLLM呼び出し最大3回（コスト制御）
- 検出対象：誤字・脱字、表記ゆれ、©年号、電話番号・メールアドレスのフォーマット

### 4.3 FB（フィードバック）出力仕様

#### FB選択の仕組み
- 各チェック結果に「FBに追加」チェックボックス
- 全エラーではなく、ディレクターが判断した項目のみ選択
- 設計意図：自動チェック結果には「意図的にそうしている項目」も含まれるため、人間の判断フィルタが必要

#### Markdown出力フォーマット

```markdown
## WebCheck レポート: https://example.com
チェック日時: 2026-04-07 15:30
対象: 4件

### ❌ Critical

#### 1. OGP画像が未設定
- カテゴリ: メタ情報
- 場所: `<head>`
- 現状: og:image タグなし
- 推奨: 1200x630px の画像URLを og:image に設定
- 参考: https://ogp.me/

#### 2. コントラスト比不足（3件）
- カテゴリ: アクセシビリティ
- 場所: `.hero-subtitle`, `.footer-link`, `.caption`
- 現状: コントラスト比 2.8:1（AA基準 4.5:1 必要）
- 推奨: テキスト色を #595959 以上の暗さに変更

### ⚠️ Warning

#### 3. alt="" の画像（装飾画像でない可能性）
- カテゴリ: 画像/alt
- 場所: `section.about > img:nth-child(2)`
- 現状: alt属性が空
- 推奨: 画像内容を説明するaltテキストを追加

#### 4. ©表記の年号が古い
- カテゴリ: テキスト
- 場所: `footer > .copyright`
- 現状: © 2024
- 推奨: © 2026 に更新
```

#### 「場所」の表現方法

| 情報 | 取得方法 | 用途 |
|------|---------|------|
| CSSセレクタ | DOM解析で自動取得（#id > .class > nth-child） | エンジニアがコード上で特定 |
| セクション名 | 直近のh1〜h6を参照 | 非エンジニアにもわかりやすい表記 |
| スクリーンショット + ハイライト | Phase 1.5で追加予定 | 視覚的に一目瞭然 |

#### Phase 1 の出力形式
- **Markdown出力**（コピー可能）— Backlog / GitHub Issues / Notion に貼付
- CSV / リンク共有はPhase 1.5以降

### 4.4 ステータス管理

| ステータス | 意味 | 遷移条件 |
|-----------|------|---------|
| open | チェックでエラー検出済み、未FB | 初期状態 |
| fb_sent | エンジニアに共有済み | 「FBに追加」→ 送信後に自動遷移 |
| fixed | 再チェックでパス | 「再チェック」ボタンで自動判定 |

### 4.5 再チェック機能
同じURLを再度チェックし、前回のエラーが解消されているかを自動比較する。ディレクターの「直ったかな？目視で確認…」を不要にする。

---

## 5. UI/UX設計

### 5.1 画面構成（1画面ダッシュボード）

```
┌──────────────────────────────────────────────────┐
│  [URL入力欄]                     [チェック開始]      │
├──────────────────────────────────────────────────┤
│  サマリーバー: ❌ 3 Critical  ⚠️ 8 Warning  ✅ 42 Pass │
├────────────┬─────────────────────────────────────┤
│            │                                       │
│  フィルター   │   結果リスト                          │
│            │                                       │
│  カテゴリ    │  ┌─────────────────────────────────┐ │
│  □ メタ情報  │  │ ❌ og:image が未設定              │ │
│  □ 画像/alt │  │    場所: <head>                   │ │
│  □ リンク   │  │    推奨: 1200x630px のOGP画像を設定  │ │
│  □ a11y    │  │    [☑ FBに追加] [📋コード例]        │ │
│  □ 性能    │  └─────────────────────────────────┘ │
│  □ テキスト  │                                       │
│            │  ┌─────────────────────────────────┐ │
│  深刻度     │  │ ⚠️ alt="" の画像が5件              │ │
│  □ Critical │  │    場所: セクション2, セクション4     │ │
│  □ Warning  │  │    [展開 ▼] → 個別画像リスト         │ │
│  □ Info    │  │    [☑ FBに追加] [📋コード例]        │ │
│            │  └─────────────────────────────────┘ │
│  ステータス  │                                       │
│  □ 未対応   │                                       │
│  □ FB済み   │                                       │
│  □ 修正確認済│                                       │
├────────────┴─────────────────────────────────────┤
│  FB送信パネル（下部固定バー）                          │
│  選択中: 4件  [プレビュー] [Markdown出力] [リンク共有]  │
└──────────────────────────────────────────────────┘
```

### 5.2 コンポーネント一覧

| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| UrlInput | url-input.tsx | URL入力 + チェック開始ボタン |
| SummaryBar | summary-bar.tsx | Critical/Warning/Pass集計表示 |
| FilterSidebar | filter-sidebar.tsx | カテゴリ・深刻度・ステータスフィルター |
| ResultList | result-list.tsx | チェック結果一覧 |
| ResultCard | result-card.tsx | 個別結果（展開/折りたたみ） |
| FBPanel | fb-panel.tsx | 下部固定FB送信パネル |
| FBPreview | fb-preview.tsx | Markdownプレビューモーダル |
| CategoryTabs | category-tabs.tsx | カテゴリタブ |

### 5.3 UIの振る舞い
- 結果カードは初期状態で折りたたみ。クリックで展開
- FBパネルは選択項目が1件以上のときのみスライドアップで表示
- ローディング中はカテゴリごとにスケルトンUIを表示
- 左サイドバーはPhase 1では常時表示（折りたたみ不可）

### 5.4 レスポンシブ

| ブレークポイント | レイアウト |
|---------------|----------|
| ≥1024px | サイドバー + コンテンツ |
| 768–1023px | サイドバーがコンテンツ上部の水平フィルターバーに |
| <768px | 単一カラム、フィルターは折りたたみドロップダウン、FBパネル全幅 |

---

## 6. 技術仕様

### 6.1 技術スタック

| レイヤー | 技術 | バージョン |
|---------|------|----------|
| フレームワーク | Next.js (App Router) | 15.x |
| UI | shadcn/ui + Tailwind CSS v4 | 最新 |
| HTMLパース | cheerio | 最新 |
| ブラウザ自動操作 | Playwright | 最新 |
| アクセシビリティ | @axe-core/playwright | 最新 |
| パフォーマンス | Lighthouse (Node API) | 最新 |
| LLM | @anthropic-ai/sdk (Claude Sonnet) | 最新 |
| DB | SQLite via better-sqlite3 | 最新 |
| 言語 | TypeScript (strict mode) | 5.x |
| パッケージマネージャ | bun | 最新 |

### 6.2 型定義

```typescript
/** チェック結果1件 */
type CheckResult = {
  id: string                          // UUID
  category: Category
  severity: 'critical' | 'warning' | 'info' | 'pass'
  title: string                       // 「og:image が未設定」
  location: string                    // CSSセレクタ or HTML要素パス
  locationHuman: string               // 「<head>内」「セクション2」等
  currentValue: string | null         // 現在の値（なければnull）
  recommendation: string              // 推奨対応
  codeExample?: string                // 修正コード例（任意）
  status: 'open' | 'fb_sent' | 'fixed'
}

type Category =
  | 'meta'          // メタ情報
  | 'images'        // 画像・alt
  | 'links'         // リンク
  | 'a11y'          // アクセシビリティ
  | 'performance'   // パフォーマンス
  | 'text'          // テキスト・表記

type CheckReport = {
  id: string
  url: string
  checkedAt: string                   // ISO 8601
  results: CheckResult[]
  summary: {
    critical: number
    warning: number
    info: number
    pass: number
    total: number
  }
}

type FBExportRequest = {
  reportId: string
  selectedIds: string[]
  format: 'markdown' | 'csv'
}

/** チェッカー共通インターフェース */
type Checker = (dom: CheerioAPI, url: string) => Promise<CheckResult[]>

/** ブラウザ必要なチェッカー（axe-core, Lighthouse） */
type BrowserChecker = (
  dom: CheerioAPI,
  url: string,
  page: Page
) => Promise<CheckResult[]>
```

### 6.3 API設計

#### POST /api/check
```
Request:  { url: string }
Response: { report: CheckReport }

処理フロー:
1. URLバリデーション（http/https のみ、プライベートIPブロック）
2. HTML取得（Phase 1初期: fetch + cheerio。Phase 1後半: Playwright）
3. 6チェッカー並列実行（Promise.allSettled — 1つの失敗が他に影響しない）
4. CheckReport形式に統合
5. SQLiteに保存
6. レスポンス返却
```

#### POST /api/export
```
Request:  { reportId: string, selectedIds: string[], format: 'markdown' | 'csv' }
Response: { content: string, filename: string }
```

### 6.4 DBスキーマ

```sql
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id),
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  location_human TEXT,
  current_value TEXT,
  recommendation TEXT,
  code_example TEXT,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_results_report ON results(report_id);
CREATE INDEX idx_results_category ON results(category);
CREATE INDEX idx_results_severity ON results(severity);
```

### 6.5 エラーハンドリング方針

| エラー種別 | 対応 |
|-----------|------|
| URL接続不可 | 「URLにアクセスできません」表示。チェック中断 |
| Playwright タイムアウト | 30秒でタイムアウト。メッセージ表示 |
| axe-core 実行失敗 | a11yカテゴリのみスキップ。他は続行 |
| Lighthouse 実行失敗 | performanceカテゴリのみスキップ。他は続行 |
| LLM API エラー | LLM依存項目のみスキップ。ルールベース項目は続行 |
| リンクチェック部分失敗 | タイムアウトしたリンクはwarning報告。他は続行 |

**原則: 1つのチェッカーの失敗が他のチェッカーに影響しない。**

### 6.6 セキュリティ考慮
- 入力URLのプロトコル制限（http/https のみ）
- プライベートIPブロック（SSRF防止）
- Playwright は `--no-sandbox` 不使用
- LLM送信テキストのPII: Phase 1は注意喚起のみ、Phase 2以降でフィルタリング検討

### 6.7 LLM使用箇所と制約

| 使用箇所 | モデル | 用途 | コスト制御 |
|---------|-------|------|-----------|
| alt品質判定 | Claude Sonnet | 画像altの適切さスコアリング | Phase 1ではルールベースのみでも可 |
| テキスト誤字検出 | Claude Sonnet | 誤字・表記ゆれ・©年号チェック | 最大5セクション、LLM呼び出し3回/チェック |
| 装飾画像 vs コンテンツ画像 | Claude Sonnet | 分類判定 | Phase 1ではルールベース（role属性）のみ |

---

## 7. デザイン仕様

### 7.1 デザイントーン
Stripe系 — ライト基調、上品なグラデーション、精密。
詳細はDESIGN.mdに全トークン定義済み。

### 7.2 デザインシステム構成

| ファイル | 役割 |
|---------|------|
| DESIGN.md | カラーパレット、タイポグラフィ、コンポーネントスタイル、レイアウト原則、Do's/Don'ts |
| shadcn/ui | コンポーネント実装基盤（DESIGN.mdトークンで上書き） |
| Tailwind CSS v4 | ユーティリティクラス |

### 7.3 カラートークン（クイックリファレンス）

```
テキスト:   --ink: #0A2540 / --slate: #425466 / --mist: #6B7C93
背景:       --canvas: #FFFFFF / --surface: #F6F9FC / --border: #E3E8EE
アクセント:  --accent: #635BFF（Stripe紫）
ステータス:  --critical: #DC2626 / --warning: #D97706 / --pass: #16A34A / --info: #2563EB
```

### 7.4 結果カードの視覚設計
- 白背景 + 1px border + border-radius 8px
- **左ボーダー3pxで深刻度を色分け**（赤=critical, 黄=warning, 緑=pass）
- 背景全体を着色しない（項目が多いと目が疲れるため）
- CSSセレクタはモノスペースのinline codeブロックで表示

### 7.5 フォント
- システムフォントスタック: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif`
- モノスペース: `"SF Mono", "Fira Code", "Fira Mono", monospace`
- Söhne（Stripe固有）はライセンス不可のため不使用

---

## 8. デプロイ構成

### Phase 1（開発・検証）
MacBook上でNext.jsをローカル実行。

### Phase 1 後半〜（本番運用）
```
[ブラウザ] → HTTPS → [Next.js フロント（Vercel）]
                           ↓ API呼び出し（Tailscale内部ネットワーク）
                     [バックエンドAPI（Mac mini 常時稼働）]
                       ├── Playwright
                       ├── axe-core
                       ├── Lighthouse
                       ├── Claude API
                       └── SQLite
```

Playwright / LighthouseはVercelのサーバーレス環境では不安定（メモリ・実行時間制限）なため、Mac miniで実行する構成。

### 共有リンクの永続化（Phase 1.5）

| 段階 | 方式 |
|------|------|
| 初期 | Mac mini + SQLite（Tailscale経由アクセス） |
| 外部共有必要時 | Supabaseに移行 |

---

## 9. プロジェクト管理

### 9.1 ディレクトリ構造

```
webcheck/
├── CLAUDE.md               # Claude Code実行指示書
├── ARCHITECTURE.md          # 技術アーキテクチャ詳細
├── DESIGN.md                # デザインシステム定義
├── SPEC.md                  # この仕様書
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/
│   │       ├── check/route.ts
│   │       └── export/route.ts
│   ├── components/
│   │   ├── url-input.tsx
│   │   ├── summary-bar.tsx
│   │   ├── filter-sidebar.tsx
│   │   ├── result-list.tsx
│   │   ├── result-card.tsx
│   │   ├── fb-panel.tsx
│   │   ├── fb-preview.tsx
│   │   └── category-tabs.tsx
│   ├── lib/
│   │   ├── checkers/
│   │   │   ├── meta.ts
│   │   │   ├── images.ts
│   │   │   ├── links.ts
│   │   │   ├── a11y.ts
│   │   │   ├── performance.ts
│   │   │   └── text.ts
│   │   ├── checker-runner.ts
│   │   ├── page-fetcher.ts
│   │   ├── llm.ts
│   │   ├── markdown-export.ts
│   │   └── db.ts
│   ├── types/index.ts
│   └── utils/severity.ts
├── db/schema.sql
├── package.json
└── tsconfig.json
```

### 9.2 ハーネスファイルの役割分担

| ファイル | 読み手 | 更新タイミング |
|---------|-------|--------------|
| SPEC.md（本文書） | 人間（企画・判断用） | 仕様変更・Phase移行時 |
| CLAUDE.md | Claude Code（タスク実行） | 技術スタック・Phase変更時 |
| ARCHITECTURE.md | Claude Code（個別実装） | チェッカー追加・DB変更時 |
| DESIGN.md | Claude Code（UI生成） | デザイントーン変更時 |

### 9.3 チェッカー追加の手順
新しいチェックカテゴリを追加する場合：

1. `src/lib/checkers/` に新ファイル作成
2. `Checker` 型（または `BrowserChecker` 型）に準拠して実装
3. `checker-runner.ts` に登録
4. `types/index.ts` の `Category` 型に追加
5. ARCHITECTURE.md にチェック項目・閾値を追記
6. SPEC.md に仕様を追記

---

## 10. 検証・改善のための記録

### 10.1 フィジビリティ評価（初期検討時点）

| 領域 | 実現性 | 精度見込み | 備考 |
|------|--------|-----------|------|
| HTMLチェック（メタ/alt/リンク/構造） | ◎ | 高精度 | ルールベースで確実に判定可能 |
| アクセシビリティ（axe-core） | ◎ | 高精度 | WCAG基準で自動判定 |
| パフォーマンス（Lighthouse） | ◎ | 高精度 | Google公式ツール |
| テキスト誤字・表記ゆれ | △ | 中程度 | 固有名詞・業界用語で誤検知リスク |
| Figma↔実装テキスト差分 | ○ | 高精度 | Figma APIテキストノード + 文字列比較 |
| Figma↔実装ビジュアル差分 | △ | 70〜80% | LLM画像分析。ノイズ多い |
| レスポンシブ表示崩れ | △ | 中程度 | 「崩れ」の定義が曖昧 |

### 10.2 Phase 1 完了後に検証すべき項目

- [ ] メタ情報チェックの精度（偽陽性・偽陰性の頻度）
- [ ] テキスト誤字検出のLLM精度（固有名詞での誤検知率）
- [ ] リンクチェックの速度（100リンクの場合の所要時間）
- [ ] axe-coreの結果がディレクターにとって理解しやすいか
- [ ] Lighthouseスコアの取得安定性
- [ ] Markdown FB出力の実用性（エンジニアが実際に使えるか）
- [ ] 再チェック機能の差分比較精度

### 10.3 DESIGN.mdの注意点
- awesome-design-md リポジトリは★75（情報源の「★5,100」は誤り）
- 各DESIGN.mdは公式デザインシステムではなく、目視+CSS抽出で作成されたもの
- WebCheck用のDESIGN.mdはStripeベースでカスタマイズ済み（他社VIのそのまま借用ではない）
- Google Stitchが提唱した概念。Stitch DESIGN.mdフォーマット準拠

### 10.4 将来の技術課題メモ

**Figmaビジュアル差分（Phase 2）の実装方針:**
- Figmaはスタティックなデザインデータであり、WebはレスポンシブかつJSによる動的描画
- Figma APIから取得可能なのはノード情報（座標・色・フォント）またはラスタ画像
- 画像ベース差分はアンチエイリアスやレンダリング差異でノイズが大量に出る
- 現実的アプローチ: 画像差分 → Claude Vision で「意味のある差異か」を判定
- テキスト差分: Figma APIテキストノード抽出 → 実装テキストと文字列比較（こちらは高精度）

**スクリーンショット＋ハイライト（Phase 1.5）の実装方針:**
- Playwrightで要素のbounding box取得 → スクリーンショット上にオーバーレイ描画
- 長いページはセクション単位で分割撮影
- 固定ヘッダーやモーダルが被る場合はPlaywright側で非表示処理が必要

---

## 更新履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-04-07 | v1.0 | 初版作成。Phase 1仕様確定 |
