//server/app.js
import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors';
import viewer from "./routes/viewer.js";
dotenv.config()

import ingest from './routes/ingest.js'
import compose from './routes/compose.js'

const app = express()
app.use(express.json())

app.use(cors({ origin: true, credentials: true }));
app.options('*', cors());
app.use("/viewer", viewer);
app.use("/seq-static", express.static("storage/seq", { maxAge: "1h" }));
app.use("/viewer-static", express.static("storage/renders", { maxAge: "1h" }));

app.get('/healthz', (_req, res) =>
  res.json({ ok: true, now: new Date().toISOString() })
)

app.use('/ingest', ingest)
app.use('/compose', compose)

// Node 18 미만 대비: fetch 폴리필
if (typeof fetch === 'undefined') {
  const { default: nf } = await import('node-fetch')
  global.fetch = nf
}

app.post('/capture/start', async (req, res, next) => {
  try {
    const port = parseInt(process.env.PORT, 10) || 8081
    // compose 라우터의 실제 엔드포인트로 프록시
    const url = `http://localhost:${port}/compose/5bg`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body || {})
    })
    const text = await r.text()
    let data = {}
    try { data = JSON.parse(text) } catch {}
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ error: 'compose failed', status: r.status, detail: text.slice(0, 500) })
    }
    res.json(data)
  } catch (e) {
    next(e)
  }
})

const PORT = parseInt(process.env.PORT, 10) || 8081
app.listen(PORT, () => console.log(`core-backend listening :${PORT}`))
