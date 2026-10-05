import { spawn } from 'node:child_process'

const isWin = process.platform === 'win32'

const server = spawn(process.execPath, ['server/dev-server.js'], { stdio: 'inherit' })
const vite = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: isWin,
})

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.kill()
  vite.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

server.on('error', (err) => {
  console.error('[dev:all] Failed to start API server:', err.message)
  shutdown()
})

vite.on('error', (err) => {
  console.error('[dev:all] Failed to start Vite:', err.message)
  shutdown()
})