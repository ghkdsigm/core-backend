import express from 'express'
import dotenv from 'dotenv'
dotenv.config()

import ingest from './routes/ingest.js'
import compose from './routes/compose.js'

const app = express()
app.use(express.json())

// 디버그: 라우터 타입 확인
console.log('[debug] typeof ingest:', typeof ingest)
console.log('[debug] typeof compose:', typeof compose)

app.get('/healthz', (_req, res) => res.json({ ok: true, now: new Date().toISOString() }))

app.use('/ingest', ingest) // 반드시 function이어야 함
app.use('/compose', compose)

const PORT = Number(process.env.PORT || 8081)
app.listen(PORT, () => console.log(`core-backend listening :${PORT}`))
