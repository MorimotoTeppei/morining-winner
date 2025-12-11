# 🌅 Morning Winner - 朝活トラッキングシステム

Discord朝活の参加状況を自動記録して可視化するシステムです。Google SheetsとGoogle Apps Scriptを使用しているため、**完全無料**で運用できます。

## ✨ 機能

- 🎤 **ボイスチャンネル参加の自動記録**
  - 参加/退出時刻を自動検知
  - 滞在時間を自動計算
  - Google Sheetsに自動保存

- 📊 **リアルタイムダッシュボード**
  - 日別参加時間グラフ（折れ線グラフ）
  - 活動ヒートマップ（GitHub風）
  - 参加時間ランキング
  - 統計サマリー（総時間、平均時間など）

- 💰 **完全無料**
  - Supabase不要
  - Google Sheets/GASの無料枠で運用可能

## 🏗️ システム構成

```
Discord Bot (Node.js)
    ↓ ボイスチャンネル参加を監視
    ↓
Google Sheets (データベース)
    ↓ データを保存
    ↓
Google Apps Script (可視化)
    → Webダッシュボードを表示
```

## 📋 前提条件

- Node.js 18以上
- Discordアカウント
- Googleアカウント

## 🚀 セットアップ手順

### 1. Discord Botの作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」をクリックして新しいアプリケーションを作成
3. 左メニューから「Bot」を選択
4. 「Add Bot」をクリック
5. **Bot Token** をコピーして保存（後で使います）
6. **Privileged Gateway Intents** で以下を有効化：
   - `SERVER MEMBERS INTENT`
   - `PRESENCE INTENT`
7. 左メニューから「OAuth2」→「URL Generator」を選択
8. **SCOPES** で `bot` を選択
9. **BOT PERMISSIONS** で以下を選択：
   - `View Channels`
   - `Connect`
   - `Speak`
10. 生成されたURLからBotをサーバーに招待

### 2. Google Cloud Projectの設定

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. **Google Sheets API** を有効化
4. **認証情報**を作成：
   - 「認証情報を作成」→「サービスアカウント」
   - サービスアカウント名を入力（例: `morning-winner-bot`）
   - 「キーを追加」→「新しいキーを作成」→「JSON」
   - ダウンロードしたJSONファイルを `credentials.json` として保存

### 3. Google Sheetsの準備

1. [Google Sheets](https://sheets.google.com/) で新しいスプレッドシートを作成
2. シート名を「**ActivityLog**」に変更
3. スプレッドシートのURLから **SPREADSHEET_ID** をコピー
   ```
   https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
   ```
4. スプレッドシートを **Service Accountのメールアドレス** と共有
   - `credentials.json` の `client_email` の値をコピー
   - スプレッドシートの「共有」から編集権限を付与

### 4. プロジェクトのセットアップ

```bash
# リポジトリをクローン
git clone <your-repo-url>
cd morining-winner

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env
# .envファイルを編集して以下を設定:
# - DISCORD_TOKEN (Discord Botのトークン)
# - VOICE_CHANNEL_ID (監視するボイスチャンネルのID)
# - SPREADSHEET_ID (Google SheetsのID)
```

### 5. ボイスチャンネルIDの取得

1. Discordの「設定」→「詳細設定」で「開発者モード」を有効化
2. 監視したいボイスチャンネルを右クリック
3. 「IDをコピー」を選択
4. `.env` ファイルの `VOICE_CHANNEL_ID` に貼り付け

### 6. Google Sheetsの初期化

```bash
# Sheetsにヘッダー行を追加
node setup-sheets.js
```

成功すると `✅ セットアップ完了！` と表示されます。

### 7. Botの起動

```bash
# Botを起動
npm start

# または開発モード（ファイル変更で自動再起動）
npm run dev
```

起動に成功すると以下のように表示されます：
```
✅ Bot起動完了: YourBotName#1234
📊 朝活トラッキング開始...
🎯 監視チャンネルID: 123456789012345678
```

### 8. ダッシュボードのデプロイ

1. Google Sheetsを開く
2. 「拡張機能」→「Apps Script」を選択
3. `Code.gs` の内容を `gas/Code.gs` からコピー&ペースト
4. 「+」ボタンで HTMLファイルを追加
   - ファイル名: `Dashboard`
   - 内容を `gas/Dashboard.html` からコピー&ペースト
5. 「デプロイ」→「新しいデプロイ」を選択
6. 種類: 「ウェブアプリ」
7. 設定:
   - 「次のユーザーとして実行」: 自分
   - 「アクセスできるユーザー」: 全員
8. 「デプロイ」をクリック
9. 生成されたURLがダッシュボードのURLです

## 📱 使い方

1. Botを起動した状態で、設定したボイスチャンネルに参加
2. 参加/退出が自動的にGoogle Sheetsに記録されます
3. ダッシュボードURLにアクセスしてデータを確認

### ダッシュボードの見方

- **統計カード**: 総セッション数、参加メンバー数、総活動時間、平均参加時間
- **日別グラフ**: 日ごとの参加時間と参加人数の推移
- **ランキング**: メンバー別の参加時間ランキング
- **ヒートマップ**: GitHub風のアクティビティ表示

## 🔧 トラブルシューティング

### Botが起動しない

- `.env` ファイルの設定を確認
- `DISCORD_TOKEN` が正しいか確認
- Node.jsのバージョンを確認（18以上推奨）

### Sheetsに記録されない

- `credentials.json` が正しい場所にあるか確認
- Service AccountのメールアドレスとSheets共有を確認
- `SPREADSHEET_ID` が正しいか確認
- `ActivityLog` シートが存在するか確認

### ダッシュボードが表示されない

- Apps Scriptのデプロイ設定を確認
- 「アクセスできるユーザー」が「全員」になっているか確認
- スクリプトにエラーがないか確認（Apps Scriptのログを確認）

## 📂 ファイル構成

```
morining-winner/
├── bot.js              # Discord Bot本体
├── sheets.js           # Google Sheets連携
├── setup-sheets.js     # Sheets初期化スクリプト
├── package.json        # npm設定
├── .env.example        # 環境変数テンプレート
├── .env                # 環境変数（作成必要）
├── credentials.json    # Google API認証情報（作成必要）
└── gas/
    ├── Code.gs         # Google Apps Script
    └── Dashboard.html  # ダッシュボードHTML
```

## 🎯 今後の拡張案

- [ ] 通知機能（連続参加記録達成時など）
- [ ] 週次/月次レポート
- [ ] 目標設定機能
- [ ] スマホアプリ対応
- [ ] CSV/PDFエクスポート

## 📝 ライセンス

MIT

## 🙋 サポート

質問や問題があれば、GitHubのIssuesで報告してください。

---

**朝活、頑張りましょう！** 🌟
