# PivotCore 製品ページ デプロイ・昇格手順書（UAT → 検証 → 本番）

製品ページシステムを **UAT → 検証 → 本番** の3段階で安全にリリース・運用するための手順書です。
1つの Cloudflare Pages プロジェクトを、GitHub のブランチで環境分けする構成を採用します。

---

## 1. 環境一覧

| 環境 | ブランチ | 公開URL | 用途 | アクセス制限 |
|---|---|---|---|---|
| UAT | `uat` | `https://uat.pivotcore-products.pages.dev/products/` | 業務側による受け入れ確認 | Cloudflare Access（社内メールのみ） |
| 検証 | `staging` | `https://staging.pivotcore-products.pages.dev/products/` | 本番同等での最終技術確認 | Cloudflare Access（社内メールのみ） |
| 本番 | `main` | `https://www.pivotcore.jp/products/` | 一般公開 | なし（公開） |

- プレビュー環境（UAT・検証）は Cloudflare が自動で検索エンジンのインデックス対象から除外するため、誤って検索結果に出ることはありません。
- 本番のみ、独自ドメイン `www.pivotcore.jp` の `/products/` 配下にプロキシ Worker 経由で公開します（後述）。

---

## 2. 全体の流れ

リリースには2つのフェーズがあります。

**初期構築フェーズ**（システム全体の検証）
build.js・テンプレート・管理画面・Worker を含むシステム一式を、UAT → 検証 → 本番の順に検証して初回リリースします。

**運用フェーズ**（コンテンツの追加・修正）
本番稼働後、担当者が管理画面で型番を追加・修正します。変更は同じ昇格フロー（uat → staging → main）を通って本番へ反映されます。

どちらのフェーズでも、本番に出るのと**完全に同一の成果物**を事前環境で確認できるのが、この構成の要点です（出力を `/products/` 配下にマウントしているため、プレビューでも本番でもパス構造・内部リンク・canonical がすべて一致します）。

---

## 3. 事前準備（インフラ構築・初回のみ）

### 3.1 Cloudflare Pages プロジェクト作成
1. Cloudflare ダッシュボード → Workers & Pages → Pages でプロジェクトを作成（例: `pivotcore-products`）。
2. 本番ブランチ（Production branch）を `main` に設定。
3. プロジェクト名を変えた場合は、`.github/workflows/deploy-products.yml` と `infra/wrangler.toml`（`PAGES_HOST`）の値も合わせて変更。

### 3.2 GitHub ブランチと保護ルール
1. リポジトリに `uat` / `staging` / `main` の3ブランチを用意。
2. ブランチ保護ルールで、`staging` と `main` への直接 push を禁止し、Pull Request + レビュー承認を必須にする。
   - これが「検証 → 本番」のリリースゲートになります。

### 3.3 GitHub Actions のシークレット登録
リポジトリ設定 → Secrets and variables → Actions に以下を登録。
- `CLOUDFLARE_API_TOKEN`（Pages 編集権限を持つ API トークン）
- `CLOUDFLARE_ACCOUNT_ID`

これで `uat` / `staging` / `main` のいずれかに push されると、対応するブランチへ自動ビルド・デプロイされます。

### 3.4 本番ドメイン（www.pivotcore.jp/products/）の配信設定
本番は既存サイト（GitHub Pages の SPA）が動く `www.pivotcore.jp` の `/products/` 配下のみを Pages に向けます。Cloudflare ではパス単位でドメインを直接 Pages に割り当てることはできないため、その経路で動くリバースプロキシ Worker を使います。

1. **DNS を Cloudflare へ**: `pivotcore.jp` を Cloudflare のゾーンとして登録（ネームサーバを Cloudflare に変更）。`www` レコードは既存の GitHub Pages を指したまま、プロキシ（オレンジ色）を有効化。
2. **SSL 設定**: Cloudflare の SSL/TLS を **Full (strict)** に設定。GitHub Pages 側の「Enforce HTTPS」と Cloudflare の Flexible 設定が併存するとリダイレクトループが起きるため、Flexible は使わない。
3. **プロキシ Worker をデプロイ**:
   ```
   cd infra
   npx wrangler deploy
   ```
   `infra/wrangler.toml` の `PAGES_HOST` が本番 Pages ホスト（例 `pivotcore-products.pages.dev`）、`routes` が `www.pivotcore.jp/products` と `www.pivotcore.jp/products/*` を指していることを確認。
4. **動作確認**: `https://www.pivotcore.jp/products/` が一覧、`https://www.pivotcore.jp/products/<型番slug>/` が個別ページを返すこと。`/products/` 以外（トップページ等）はこれまで通り GitHub Pages が応答すること。

### 3.5 UAT・検証へのアクセス制限（社内メールのみ）
プレビュー URL はそのままだと URL を知っていれば誰でも閲覧できます。社内に限定するため Cloudflare Access を有効化します。
1. Pages プロジェクト → Settings → プレビューデプロイの保護で Cloudflare Access を有効化。
2. アクセスポリシーで、許可する社内メールアドレス（またはメールドメイン）を指定。
3. UAT・検証の URL にアクセスすると、認可済みメール宛のワンタイムコード認証が要求されるようになります。

### 3.6 管理画面 Worker（編集を uat ブランチへ）
- `admin/wrangler.toml` の `GITHUB_BRANCH` は `uat` に設定済み。管理画面からの型番編集は `uat` ブランチへコミットされ、自動的に UAT 環境へ反映されます。
- Worker のシークレット（`GITHUB_TOKEN` / `ADMIN_PASSWORD`）は `wrangler secret put` で登録（README 参照）。
- `ALLOWED_ORIGIN` は管理画面の実際のオリジンに限定推奨。

### 3.7 RFQ（本体サイト側）の扱い
RFQ フォーム改修は本体サイト（GitHub Pages の SPA）への手動パッチのため、製品ページとは別トラックです。
- パッチは本体サイトの検証用ブランチかローカルで先に確認してから本番反映する。
- UAT のテスト送信が本番 RFQ Worker（`everlink-rfq…`）に実問い合わせ・実メールとして流れ込まないよう、テスト用 Worker を分けるか、送信ペイロードにテストフラグを付けて振り分ける。

---

## 4. 昇格フロー

### 初期構築フェーズ
1. `uat` ブランチに一式を揃え push → UAT 環境へデプロイ。業務側が **UAT** を実施（→ 5章チェックリスト）。
2. 指摘を `uat` で修正・再 push。UAT 合格後、`uat → staging` の PR を作成・マージ → 検証環境へデプロイ。
3. 検証環境で **最終技術確認**（→ 6章チェックリスト）。
4. 合格後、`staging → main` の PR をマージ → **本番リリース**。

### 運用フェーズ（型番の追加・修正）
1. 担当者が管理画面で編集 → `uat` へコミット → UAT 環境に自動反映。表示を確認。
2. `uat → staging` を PR・マージ → 検証で確認。
3. `staging → main` を PR・マージ → 本番反映。

> 軽微で低リスクな修正のみ運用フローを短縮する運用も可能ですが、原則は3段階を通すことを推奨します。

---

## 5. UAT チェックリスト（業務側）

- [ ] 型番一覧が表示され、検索ボックス・メーカー/カテゴリ絞り込みが正しく動く
- [ ] 一覧から各製品ページへのリンクが正しく開く（404 が出ない）
- [ ] 製品ページの掲載項目（型番・メーカー・カテゴリ・パッケージ・説明・スペック表・用途例・利用の流れ・パンくず）が要件どおり
- [ ] 「調達を相談する」から RFQ へ遷移し、型番が自動入力される
- [ ] 管理画面でのログイン・型番追加・編集・並び替え・差分プレビュー・個別プレビューが操作できる
- [ ] スマートフォン表示でレイアウトが崩れない
- [ ] 既存コーポレートサイトのデザインと違和感がない

## 6. 検証チェックリスト（技術側）

- [ ] `node build.js` がエラーなく完走し、`dist/products/` 以下が生成される
- [ ] title / meta description / canonical / OGP / JSON-LD が各ページで正しく出力される
- [ ] `sitemap.xml` に全ページの URL（本番 baseUrl）が含まれる
- [ ] 内部リンク・canonical がすべて `/products/...` で一貫している
- [ ] 本番プロキシ経由で `/products/` 配下が、それ以外が既存サイトが応答する（経路分離の確認）
- [ ] ページ表示速度・画像/フォント読み込みに問題がない

---

## 7. 本番リリース後の作業（SEO）

- **サイトマップの登録**: 本体サイトのルート `https://www.pivotcore.jp/robots.txt`（GitHub Pages 側）に `Sitemap: https://www.pivotcore.jp/products/sitemap.xml` を追記する、または Google Search Console に直接登録する。クローラはサイトルートの robots.txt のみを参照するため、製品ページ側の robots.txt だけでは不足。
- **重複コンテンツ対策**: 本番 Pages ホスト（`pivotcore-products.pages.dev`）が直接インデックスされないよう、全ページの canonical を `www.pivotcore.jp` に向けてある（実装済み）。検索エンジンは canonical 側に評価を集約する。

---

## 8. ロールバック

- **Pages のロールバック**: Cloudflare Pages のデプロイ履歴から、直前の正常な本番デプロイへワンクリックで戻せる。
- **Git でのロールバック**: 問題のあるコミットを `main` で revert し、PR をマージすると再デプロイされる。

---

## 9. 早見表

| やりたいこと | 操作 |
|---|---|
| 型番を追加・修正 | 管理画面で編集（→ uat に反映） |
| UAT を本番候補に上げる | `uat → staging` の PR をマージ |
| 検証を本番にリリース | `staging → main` の PR をマージ |
| 本番を緊急で戻す | Cloudflare Pages の履歴からロールバック |
| 環境を再ビルドしたい | GitHub Actions の対象ブランチで「Run workflow」 |
