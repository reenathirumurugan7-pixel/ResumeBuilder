import 'dotenv/config'
import express from 'express'
import { createServer } from 'node:http'
import enhanceHandler from '../api/ai/enhance.js'
import parseHandler from '../api/ai/parse.js'
import skillGapHandler from '../api/ai/skill-gap.js'
import adminUsersHandler from '../api/admin/users.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json({ limit: '1mb' }))

let seq = 0
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/ai')) {
    seq += 1
    let sub = null
    const auth = req.headers.authorization
    if (auth && auth.startsWith('Bearer ')) {
      try {
        sub = JSON.parse(
          Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString('utf8'),
        ).sub
      } catch {
        sub = 'undecodable'
      }
    }
    console.log(
      `[req#${seq}] ${new Date().toISOString()} ${req.method} ${req.originalUrl}` +
        ` ip=${req.ip} sub=${sub}` +
        ` origin=${req.headers.origin || '-'}` +
        ` ref=${(req.headers.referer || '-').slice(0, 70)}` +
        ` ua=${(req.headers['user-agent'] || '-').slice(0, 55)}`,
    )
  }
  next()
})

app.all('/api/ai/enhance', (req, res) => enhanceHandler(req, res))
app.all('/api/ai/parse', (req, res) => parseHandler(req, res))
app.all('/api/ai/skill-gap', (req, res) => skillGapHandler(req, res))
app.all('/api/admin/users', (req, res) => adminUsersHandler(req, res))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

const server = createServer(app)

server.listen(PORT, () => {
  console.log(`[server] API server running on http://localhost:${PORT}`)
  console.log(`[server] Gemini endpoint: POST http://localhost:${PORT}/api/ai/enhance`)
  console.log(`[server] Resume parser: POST http://localhost:${PORT}/api/ai/parse`)
  console.log(`[server] Skill gap analysis: POST http://localhost:${PORT}/api/ai/skill-gap`)
  console.log(`[server] Admin users: GET/POST http://localhost:${PORT}/api/admin/users`)
})
