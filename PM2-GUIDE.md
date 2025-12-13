# PM2を使用してBotを常時起動させる方法

## PM2とは？

PM2はNode.jsアプリケーション用のプロセスマネージャーです。以下の機能を提供します：

- ✅ アプリケーションの常時起動
- ✅ クラッシュ時の自動再起動
- ✅ サーバー再起動時の自動起動
- ✅ ログ管理
- ✅ リソース監視

## セットアップ手順

### 1. PM2のインストール

```bash
# プロジェクトの依存関係として既に追加されています
npm install

# またはグローバルにインストールする場合（推奨）
npm install -g pm2
```

### 2. Botの起動

```bash
# PM2でBotを起動
npm run pm2:start

# または直接PM2コマンドで
pm2 start ecosystem.config.cjs
```

起動が成功すると、以下のように表示されます：

```
┌────┬────────────────────────┬─────────────┬─────────┬───────────┬──────────┐
│ id │ name                   │ mode        │ ↺       │ status    │ cpu      │
├────┼────────────────────────┼─────────────┼─────────┼───────────┼──────────┤
│ 0  │ morning-winner-bot     │ fork        │ 0       │ online    │ 0%       │
└────┴────────────────────────┴─────────────┴─────────┴───────────┴──────────┘
```

### 3. サーバー再起動時の自動起動設定

```bash
# スタートアップスクリプトを生成
npm run pm2:startup

# 表示されたコマンドを実行（sudoが必要な場合があります）
# 例: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username

# 現在のPM2プロセスリストを保存
npm run pm2:save
```

これで、サーバーが再起動してもBotが自動的に起動するようになります。

## よく使うコマンド

### Botの状態確認

```bash
# 全てのPM2プロセスの状態を確認
npm run pm2:status

# または
pm2 status
```

### ログの確認

```bash
# リアルタイムでログを表示
npm run pm2:logs

# または
pm2 logs morning-winner-bot

# 最後の100行を表示
pm2 logs morning-winner-bot --lines 100

# エラーログのみ表示
pm2 logs morning-winner-bot --err
```

### Botの再起動

```bash
# Botを再起動
npm run pm2:restart

# または
pm2 restart morning-winner-bot
```

### Botの停止

```bash
# Botを停止
npm run pm2:stop

# または
pm2 stop morning-winner-bot
```

### Botの削除（PM2から完全に削除）

```bash
# Botを停止して削除
pm2 delete morning-winner-bot
```

### 詳細情報の確認

```bash
# メモリ使用量やCPU使用率などの詳細を確認
pm2 show morning-winner-bot

# または
pm2 info morning-winner-bot
```

### リアルタイムモニタリング

```bash
# ダッシュボード形式でリアルタイム監視
pm2 monit
```

## トラブルシューティング

### Botが起動しない場合

1. ログを確認：
   ```bash
   npm run pm2:logs
   ```

2. 環境変数が正しく設定されているか確認：
   ```bash
   cat .env
   ```

3. credentials.jsonが存在するか確認：
   ```bash
   ls -la credentials.json
   ```

### クラッシュを繰り返す場合

ecosystem.config.cjsの設定を確認：
- `max_restarts`: 最大再起動回数（デフォルト: 10回）
- `min_uptime`: 正常と見なす最小稼働時間（デフォルト: 10秒）
- `restart_delay`: 再起動までの待機時間（デフォルト: 4000ms）

### ログファイルが大きくなりすぎる場合

PM2のログローテーションモジュールをインストール：

```bash
pm2 install pm2-logrotate

# 設定例：
pm2 set pm2-logrotate:max_size 10M  # 最大10MB
pm2 set pm2-logrotate:retain 7      # 7日分保持
pm2 set pm2-logrotate:compress true # 圧縮する
```

## 本番環境での推奨設定

```bash
# 1. PM2をグローバルにインストール
npm install -g pm2

# 2. Botを起動
cd /path/to/morining-winner
npm run pm2:start

# 3. スタートアップ設定
npm run pm2:startup
# 表示されたコマンドを実行

# 4. 設定を保存
npm run pm2:save

# 5. ログローテーション設定（オプション）
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## ecosystem.config.cjsの設定詳細

現在の設定（`ecosystem.config.cjs`）：

```javascript
{
  name: 'morning-winner-bot',      // プロセス名
  script: './bot.js',               // 実行するスクリプト
  instances: 1,                     // インスタンス数
  autorestart: true,                // 自動再起動
  watch: false,                     // ファイル監視（本番ではfalse推奨）
  max_memory_restart: '200M',       // メモリ上限で再起動
  min_uptime: '10s',                // 正常稼働の最小時間
  max_restarts: 10,                 // 最大再起動回数
  restart_delay: 4000,              // 再起動までの待機時間（ms）
  error_file: './logs/error.log',   // エラーログ
  out_file: './logs/out.log',       // 標準出力ログ
  log_file: './logs/combined.log',  // 統合ログ
}
```

## まとめ

PM2を使用することで、Botを常に安定して動作させることができます。サーバーが再起動しても自動的にBotが起動するので、手動での管理が不要になります。

詳細なドキュメント: https://pm2.keymetrics.io/docs/usage/quick-start/
