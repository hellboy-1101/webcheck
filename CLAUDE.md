# CLAUDE.md — WebCheck

## プロジェクト概要

WebディレクターのためのWeb検収自動化ツール。URLを入力すると、メタ情報・画像alt・リンク・アクセシビリティ・パフォーマンス・テキスト品質を自動チェックし、エンジニアへのFBをMarkdownで出力する。

## 技術スタック

| レイヤー | 技術 | バージョン指定 |
|---------|------|--------------|
| フレームワーク | Next.js (App Router) | 15.x |
| UI | shadcn/ui + Tailwind CSS v4 | 最新 |
| HTMLパース | cheerio | 最新 |
| ブラウザ自動操作 | playwright | 最新 |
| アクセシビリティ | @axe-core/playwright | 最新 |
| パフォーマンス | lighthouse (Node API) | 最新 |
| LLM | @anthropic-ai/sdk (Claude Sonnet) | 最新 |
| DB（Phase 1） | SQLite via better-sqlite3 | 最新 |
| 言語 | TypeScript (strict mode) | 5.x |

## デザインシステム

**DESIGN.md を必ず参照してUIを構築すること。**

- カラートークン、タイポグラフィ、コンポーネントスタイルはすべてDESIGN.mdに定義済み
- shadcn/uiのデフォルトテーマをDESIGN.mdのトークンで上書きする
- フォントはシステムフォントスタック（Söhneはライセンス不可のためフォールバック使用）

```
フォント設定:
  sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif
  mono: "SF Mono", "Fira Code", "Fira Mono", monospace
```

## ディレクトリ構造

```
webcheck/
├── CLAUDE.md                  # この指示書
├── ARCHITECTURE.md            # アーキテクチャ詳細
├── DESIGN.md                  # デザインシステム定義
├── src/
│   ├── app/
│   │   ├── layout.tsx         # ルートレイアウト
│   │   ├── page.tsx           # メインダッシュボード（1画面構成）
│   │   └── api/
│   │       ├── check/
│   │       │   └── route.ts   # POST /api/check — チェック実行エンドポイント
│   │       └── export/
│   │           └── route.ts   # POST /api/export — Markdown FB出力
│   ├── components/
│   │   ├── url-input.tsx      # URL入力 + チェック開始ボタン
│   │   ├── summary-bar.tsx    # サマリーバー（Critical/Warning/Pass集計）
│   │   ├── filter-sidebar.tsx # 左サイドバー（カテゴリ・深刻度・ステータス）
│   │   ├── result-list.tsx    # チェック結果一覧
│   │   ├── result-card.tsx    # 個別結果カード（展開/折りたたみ）
│   │   ├── fb-panel.tsx       # 下部固定FB送信パネル
│   │   ├── fb-preview.tsx     # Markdownプレビューモーダル
│   │   └── category-tabs.tsx  # カテゴリタブ（メタ/alt/リンク/a11y/性能/テキスト）
│   ├── lib/
│   │   ├── checkers/
│   │   │   ├── meta.ts        # メタ情報チェッカー
│   │   │   ├── images.ts      # 画像・altチェッカー
│   │   │   ├── links.ts       # リンクチェッカー
│   │   │   ├── a11y.ts        # アクセシビリティチェッカー（axe-core）
│   │   │   ├── performance.ts # パフォーマンスチェッカー（Lighthouse）
│   │   │   └── text.ts        # テキスト・表記チェッカー
│   │   ├── checker-runner.ts  # 全チェッカー並列実行オーケストレーター
│   │   ├── page-fetcher.ts    # Playwrightでページ取得（DOM + メタデータ）
│   │   ├── llm.ts             # Claude API呼び出しユーティリティ
│   │   ├── markdown-export.ts # FB用Markdownフォーマッター
│   │   └── db.ts              # SQLite操作（チェック結果の保存・取得）
│   ├── types/
│   │   └── index.ts           # 共通型定義
│   └── utils/
│       └── severity.ts        # 深刻度判定ユーティリティ
├── db/
│   └── schema.sql             # SQLiteスキーマ
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## 型定義（実装の核）

```typescript
// types/index.ts

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

/** チェック実行結果全体 */
type CheckReport = {
  id: string                          // UUID
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

/** FB出力リクエスト */
type FBExportRequest = {
  reportId: string
  selectedIds: string[]               // FBに追加した項目のID配列
  format: 'markdown' | 'csv'
}
```

## API設計

### POST /api/check

```
Request:
  { url: string }

Response (streaming推奨 — 段階的に結果を返す):
  {
    report: CheckReport
  }

処理フロー:
  1. page-fetcher: PlaywrightでURL取得 → DOM + ページメタ情報
  2. checker-runner: 6チェッカーを並列実行
     - meta.ts:        DOMからメタタグ抽出・検証（ルールベース）
     - images.ts:      img要素のalt属性チェック（ルールベース + LLM品質判定）
     - links.ts:       a要素のhref抽出 → HTTP HEAD並列リクエスト
     - a11y.ts:        axe-core実行 → 結果をCheckResult形式に変換
     - performance.ts: Lighthouse実行 → スコア + CWV抽出
     - text.ts:        テキスト抽出 → LLMで誤字・表記ゆれ判定
  3. 結果をCheckReport形式に統合
  4. SQLiteに保存
  5. レスポンス返却
```

### POST /api/export

```
Request:
  { reportId: string, selectedIds: string[], format: 'markdown' | 'csv' }

Response:
  { content: string, filename: string }
```

## 実装ルール

### コーディング規約
- すべてのファイルにTSDocコメントを記述する
- エラーハンドリングは必ずtry-catchで囲み、ユーザー向けメッセージを返す
- チェッカーはすべて同一のインターフェースに準拠する:
  ```typescript
  type Checker = (dom: CheerioAPI, url: string) => Promise<CheckResult[]>
  ```
- LLM呼び出しは lib/llm.ts に集約し、チェッカーから直接APIを叩かない
- 環境変数は .env.local に配置（ANTHROPIC_API_KEY）

### UI実装規約
- DESIGN.md のカラートークンをCSS変数として globals.css に定義する
- shadcn/uiコンポーネントのスタイル上書きは DESIGN.md のトークンで行う
- 結果カードは展開/折りたたみ型。初期状態は折りたたみ
- FBパネルは選択項目が1件以上のときのみ表示（slideUp アニメーション）
- ローディング中はカテゴリごとにスケルトンUIを表示する

### パフォーマンス考慮
- Playwright / Lighthouse はサーバーサイドのみで実行（クライアントに露出しない）
- リンクチェックは最大50件を並列5で実行（サーバー負荷制御）
- LLM呼び出しは1チェック実行あたり最大3回に抑える（コスト制御）

## Phase 定義

### Phase 1（MVP）— 現在のスコープ
- [x] DESIGN.md 作成
- [ ] プロジェクト初期化（Next.js + shadcn/ui）
- [ ] メインダッシュボードUI（1画面）
- [ ] 6カテゴリのチェッカー実装
- [ ] FB選択 + Markdownエクスポート
- [ ] SQLiteによるレポート保存
- [ ] 再チェック機能（前回結果との差分表示）

### Phase 1.5
- [ ] スクリーンショット + 該当箇所ハイライト
- [ ] CSV / スプレッドシートエクスポート
- [ ] 共有リンク生成

### Phase 2
- [ ] Figma API連携（テキスト差分）
- [ ] Figmaデザインとの画像比較（LLM Vision）

### Phase 3
- [ ] マルチページ一括チェック
- [ ] チーム機能（複数ユーザー、権限管理）
- [ ] Slack / Backlog 連携

## デプロイ構成

```
[ユーザーブラウザ]
       ↓ HTTPS
[Next.js フロントエンド] — Vercel
       ↓ API呼び出し（Tailscale経由 or 同一サーバー）
[バックエンドAPI] — Mac mini（常時稼働）
  ├── Playwright（ページ取得）
  ├── axe-core（a11yチェック）
  ├── Lighthouse（パフォーマンス）
  ├── Claude API（LLM判定）
  └── SQLite（結果保存）
```

Phase 1では Mac mini 上で Next.js ごと動作させる構成で十分。
Vercel分離はPhase 1.5以降で検討する。

## 最初の実装ステップ（このファイルを読んだ後）

1. `npx create-next-app@latest webcheck --typescript --tailwind --app --src-dir`
2. shadcn/ui 初期化: `npx shadcn@latest init`
3. DESIGN.md のカラートークンを `src/app/globals.css` のCSS変数に展開
4. 型定義ファイル `src/types/index.ts` を作成
5. `src/components/url-input.tsx` — URL入力コンポーネントを実装
6. `src/lib/checkers/meta.ts` — メタ情報チェッカーを最初に実装（最も単純で検証しやすい）
7. `src/app/api/check/route.ts` — APIルートを実装し、meta チェッカーだけ接続
8. 動作確認: URL入力 → メタ情報チェック結果が画面に表示されること
