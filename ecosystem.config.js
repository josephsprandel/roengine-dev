module.exports = {
  apps: [
    {
      name: 'ai-automotive-repair',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 0.0.0.0',
      cwd: '/home/jsprandel/roengine',
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'retell-sync-date',
      script: 'curl',
      args: '-sf http://localhost:3000/api/retell/sync-date',
      cwd: '/home/jsprandel/roengine',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 6 * * *',  // 6 AM daily (before shop opens)
      autorestart: false,
      watch: false,
    }
  ]
}
