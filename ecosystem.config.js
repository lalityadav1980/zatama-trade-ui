module.exports = {
  apps: [{
    name: 'zatama-trade-ui',
    script: './node_modules/.bin/serve',
    args: '-s build -l 3000',
    cwd: '/home/ubuntu/zatama-trade-ui',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
