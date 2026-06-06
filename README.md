# PivotCore 製品ページ生成システム

`products.json` に型番を追記するだけで、SEO最適化済みの製品ページが自動生成・公開される仕組みです。
WordPress を使わず、**月額コスト0円・CDN配信・静的ファイル構成**で運用します。

```
pivotcore.jp/              ← GitHub Pages（既存サイト・そのまま）
pivotcore.jp/products/     ← Cloudflare Pages（このリポジトリが生成）
  ├── /                    ← 型番一覧ページ（検索・絞り込み付き）
  └── /stm32f103c8t6/      ← 各製品ページ（静的HTML・自動生成）
```

---

## 📁 ファイル構成

```
pivotcore-products/
├── products-data/
│   ├── products.json          ← ★担当者が編集するデータ（ここに型番を追記）
│   └── products.schema.json    … 入力補助用スキーマ（編集不要）
├── templates/
│   ├── product.html            … 個別製品ページのテンプレート
│   └── index.html              … 型番一覧ページのテンプレート
├── build.js                    … 静的生成スクリプト（依存ゼロ）
├── package.json
├── .github/workflows/
│   └── deploy-products.yml      … 自動ビルド & デプロイ設定
├── admin/
│   ├── admin.html              … 非エンジニア向け管理画面（1ファイル）
│   ├── worker.js               … GitHub API 中継 Worker
│   └── wrangler.toml           … Worker 設定
├── rfq-email-confirm-patch.md  … 既存RFQフォームへのメール確認欄追加手順
└── dist/                       … 生成物（自動生成・コミット不要）
```

---

## 🟢 担当者向け：型番の追加方法

### 方法A：管理画面から追加（推奨・エンジニア不要）

1. ブラウザで **管理画面（admin.html）** を開く
2. Worker URL とパスワードでログイン
3. 「**型番を追加**」→ 必要項目を入力 → 「**保存**」
4. 「**変更差分を確認**」で内容をチェック
5. 「**公開する**」を押す → 数分後にサイトへ自動反映

並び替え（▲▼）・編集・削除・ページプレビューもこの画面で行えます。

### 方法B：products.json を直接編集（GitHub操作）

`products-data/products.json` の `products` 配列に、以下を1件追記して保存（コミット）するだけです。

```json
{
  "partNumber": "STM32F103C8T6",
  "manufacturer": "STMicroelectronics",
  "category": "マイコン (MCU)",
  "package": "LQFP-48",
  "description": "調達状況や特徴を簡潔にご記入ください。",
  "datasheetUrl": "https://www.st.com/...",
  "specs": [
    { "label": "コア", "value": "ARM® Cortex®-M3" },
    { "label": "動作周波数", "value": "72 MHz" }
  ],
  "applications": ["産業機器制御", "FA機器"],
  "keywords": ["STM32", "マイコン", "MCU"]
}
```

| 項目 | 必須 | 説明 |
|------|------|------|
| `partNumber` | ✅ | 型番。URL（`/products/{型番を小文字化}/`）の元になります |
| `manufacturer` | ✅ | メーカー名 |
| `category` | ✅ | カテゴリ（例：マイコン (MCU)） |
| `package` | | パッケージ |
| `description` | | 簡易説明文 |
| `datasheetUrl` | | データシートURL |
| `specs` | | スペック表（項目・内容のペア） |
| `applications` | | 用途例 |
| `keywords` | | 検索キーワード |

> プッシュ（保存）すると GitHub Actions が自動でビルド・デプロイします。数分後に公開されます。

---

## 🔧 エンジニア向け：初期セットアップ

### 1. ローカルでビルド確認

```bash
node build.js          # dist/ に生成
npm run preview        # http://localhost:3000 でプレビュー
```

依存パッケージはありません（Node 18+ のみ）。

### 2. Cloudflare Pages（製品ページ配信）

1. Cloudflare Pages で本リポジトリを連携、または Direct Upload を設定
2. ビルド設定：
   - Build command: `node build.js`
   - Build output directory: `dist`
3. カスタムドメインで `pivotcore.jp/products/*` にルーティング
   （DNS / リバースプロキシ構成は運用方針に合わせて最終決定）

### 3. GitHub Actions（自動デプロイ）

`.github/workflows/deploy-products.yml` がコミットをトリガーに動きます。
リポジトリの **Settings → Secrets and variables → Actions** に以下を登録：

| Secret | 内容 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Pages 編集権限のある API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウントID |

`--project-name` はワークフロー内の Pages プロジェクト名と一致させてください。

### 4. 管理画面 & 中継 Worker

```bash
cd admin
npx wrangler deploy                       # Worker をデプロイ
npx wrangler secret put ADMIN_PASSWORD    # 管理画面パスワード
npx wrangler secret put GITHUB_TOKEN      # repo 権限の Fine-grained PAT
```

`wrangler.toml` の `[vars]`（GITHUB_OWNER / REPO / BRANCH / FILE_PATH / ALLOWED_ORIGIN）を環境に合わせて設定します。
`admin.html` は任意の静的ホスティング（Cloudflare Pages 等、`noindex` 推奨）に配置し、ログイン時に Worker URL を指定します。

> **セキュリティ**：GitHub トークンや管理パスワードはすべて Worker の Secret に保持され、ブラウザ（admin.html）には一切埋め込まれません。

### 5. 既存サイト側の RFQ フォーム改修

`rfq-email-confirm-patch.md` の手順に従い、既存 `index.html` へ
メールアドレス確認欄（リアルタイム一致チェック）と型番プリフィルを追加します。

---

## 生成される SEO 要素（自動）

各製品ページに以下が自動付与されます：

- 最適化された `<title>` / `meta description` / `keywords`
- `canonical` URL（`/products/{slug}/`）
- OGP / Twitter Card
- 構造化データ：`schema.org/Product` + `BreadcrumbList`（JSON-LD）
- パンくずリスト（ホーム ＞ 型番検索 ＞ メーカー ＞ 型番）
- `sitemap.xml` / `robots.txt`

数千件規模に拡張しても追加コストは発生しません。
