# ooju SNS ダッシュボード

Instagram [@ooju.official](https://www.instagram.com/ooju.official/) の実績ダッシュボード。
GitHub Pagesで公開する静的サイトです（ビルド不要）。

## 構成

| ファイル | 役割 |
|---|---|
| `index.html` | ダッシュボード本体（マークアップ） |
| `styles.css` | oojuブランドトークン＋UIスタイル |
| `app.js` | `data.json` を読み込んで描画 |
| `data.json` | **実績データ本体（更新はこのファイルだけ）** |
| `assets/logo-ink.svg` | oojuロゴ |
| `design/` | Claude Design（claude.ai/design）用のUIカンプ。サイトには不要 |

## 機能

- KPIタイル（フォロワー・ビュー・リーチ・インタラクション・プロフィールアクセス・外部リンクタップ率・ER）
- 期間切替（過去7日 / 過去30日）
- フォロワー数の推移（更新のたびに `history` にスナップショットが蓄積）
- 投稿ごとのいいね数（ホバーで詳細ツールチップ）
- ビュー / インタラクションのコンテンツタイプ別内訳
- よく見られている投稿（エンゲージメント順トップ5）
- やることリスト（タグ付けされた投稿への リポスト / お礼 対応。チェック状態は閲覧ブラウザのlocalStorageに保存）
- 投稿一覧テーブル（ER付き）

## データの更新方法

Claude（Cowork）に「**oojuのSNSダッシュボード更新して**」と依頼する。Claudeが行うこと：

1. Chrome（ooju.officialログイン済み）で以下を取得
   - プロフィール: `instagram.com/api/v1/users/web_profile_info/?username=ooju.official`（フォロワー・投稿数）
   - 投稿一覧: `instagram.com/api/v1/feed/user/52399624223/`（いいね・コメント・再生数）
   - アカウントインサイト: `instagram.com/accounts/insights/?timeframe=7` と `?timeframe=30`（ビュー・リーチ・インタラクション・プロフィールアクセス・リンクタップ・内訳%）
   - タグ付け投稿: `instagram.com/ooju.official/tagged/` のDOM → 各投稿を `api/v1/media/{pk}/info/` で詳細取得
2. `data.json` を更新
   - `generatedAt` / `account` / `insights` / `posts` / `tagged` を最新化
   - `history` 配列に **今日のスナップショットを追記**（上書きしない。同日再実行時は同日行を置換）
3. `git commit` → `git push`（GitHub Pagesが自動反映、数分）

※ アカウント指標（ビュー等）はInstagram Webインサイトの表示値（概数）。投稿ごとの数値はAPIの実数。

## 公開

GitHub Pages（mainブランチ / root）。リポジトリをpushすると自動でデプロイされます。
