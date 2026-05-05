// PM2 Ecosystem Config — KurumiMail Production
// Cài PM2: npm install -g pm2
// Khởi chạy: pm2 start ecosystem.config.cjs
// Tự khởi động: pm2 startup && pm2 save

module.exports = {
  apps: [
    {
      name:         'kurumi-mail',
      script:       'src/server.js',
      cwd:          '/var/www/kurumi-mail/backend',   // ← đổi theo đường dẫn thực tế
      instances:    1,          // SMTP server cần 1 instance (stateful in-memory)
      exec_mode:    'fork',
      autorestart:  true,
      watch:        false,
      max_memory_restart: '512M',

      env_production: {
        NODE_ENV:           'production',
        PORT:               3001,
        SMTP_PORT:          2525,
        EMAIL_TTL_MINUTES:  30,
        MAX_MAILBOXES:      2000,
        API_RATE_LIMIT:     300,
        MAIL_DOMAINS:       'kurumi.vn,hopthu.vn,mailtam.vn,nhanh.vn',
        CORS_ORIGINS:       'https://kurumi.vn,https://www.kurumi.vn',
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file:  '/var/log/kurumi-mail/error.log',
      out_file:    '/var/log/kurumi-mail/out.log',
      merge_logs:  true,

      // Graceful reload
      kill_timeout:     5000,
      listen_timeout:   10000,
      shutdown_with_message: true,
    },
  ],
};
