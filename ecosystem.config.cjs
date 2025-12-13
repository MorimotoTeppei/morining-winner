module.exports = {
  apps: [{
    name: 'morning-winner-bot',
    script: './bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    // クラッシュ時の再起動設定
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
  }]
};
