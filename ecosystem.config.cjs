// PM2 Ecosystem Config for TDrive
// Usage: pm2 start ecosystem.config.cjs
// Works on both Windows and Linux

module.exports = {
  apps: [
    {
      name: "tdrive-api",
      script: "bun",
      args: "src/index.ts",
      cwd: "./apps/api",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "10s",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      merge_logs: true,
    },
    {
      name: "tdrive-web",
      script: "bun",
      args: "run start",
      cwd: "./apps/web",
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:3001",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "384M",
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "10s",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/web-error.log",
      out_file: "./logs/web-out.log",
      merge_logs: true,
    },
  ],
};
