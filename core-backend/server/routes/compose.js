// server/routes/compose.js
import express from 'express'
import path from 'path'
import fs from 'fs'
import { getFiveBackgroundPrompts } from '../services/bgPrompts.js'
import { composeFiveVariants } from '../services/composeSharp.js'

const router = express.Router()

const STORAGE = {
  seq: path.resolve('storage/seq'),       // 업로드 시퀀스 루트: storage/seq/<job_id|car_code>/seq
  renders: path.resolve('storage/renders')// 합성 결과 루트:   storage/renders/<job_id|car_code>/*
}

// 스토리지 루트 보장
fs.mkdirSync(STORAGE.seq, { recursive: true })
fs.mkdirSync(STORAGE.renders, { recursive: true })

/**
 * 업로드된 시퀀스 디렉터리 탐색
 * 1) storage/seq/<job_id>/seq
 * 2) storage/seq/<car_code>/seq
 */
function resolveSeqDir({ job_id, car_code }) {
  const tryPaths = []
  if (job_id) {
    const jobDir = path.join(STORAGE.seq, job_id)
    tryPaths.push({ jobDir, seqDir: path.join(jobDir, 'seq'), key: 'job_id' })
  }
  if (car_code) {
    const jobDir = path.join(STORAGE.seq, car_code)
    tryPaths.push({ jobDir, seqDir: path.join(jobDir, 'seq'), key: 'car_code' })
  }
  for (const p of tryPaths) {
    if (fs.existsSync(p.seqDir)) return p
  }
  return null
}

/**
 * 합성 공통 처리
 */
async function runCompose({ job_id, car_code }) {
  const located = resolveSeqDir({ job_id, car_code })
  if (!located) {
    const candidates = [
      job_id && path.join(STORAGE.seq, job_id, 'seq'),
      car_code && path.join(STORAGE.seq, car_code, 'seq'),
    ].filter(Boolean)
    const existing = candidates.filter(p => fs.existsSync(path.dirname(p)))
    const reason = {
      looked_for: candidates,
      parent_exists: existing,
      note: 'seq 디렉터리가 존재하지 않습니다. 업로드가 선행되었는지 확인하세요.'
    }
    const err = new Error('seq not found')
    err.status = 404
    err.meta = reason
    throw err
  }

  const { jobDir, seqDir, key } = located
  const outRootName = job_id || car_code
  const outRoot = path.join(STORAGE.renders, outRootName)
  fs.mkdirSync(outRoot, { recursive: true })

  // 프롬프트 생성 및 기록
  const prompts = await getFiveBackgroundPrompts({ car_code })
  fs.writeFileSync(path.join(jobDir, 'bg_prompts.json'), JSON.stringify(prompts, null, 2))

  // 합성 실행
  const results = await composeFiveVariants({
    job_dir: jobDir,
    seq_dir: seqDir,
    car_code,
    out_root: STORAGE.renders,
  })

  return {
    ok: true,
    car_code,
    job_id,
    used_key: key,
    job_dir: jobDir,
    seq_dir: seqDir,
    out_root: outRoot,
    results
  }
}

// 간이 시작 엔드포인트: /compose 로 POST 들어오면 /5bg 플로우로 통합
router.post('/', async (req, res) => {
  try {
    const { job_id, car_code } = req.body || {}
    if (!job_id && !car_code) {
      return res.status(400).json({ ok: false, message: 'job_id 또는 car_code 중 하나는 필수' })
    }
    const data = await runCompose({ job_id, car_code })
    return res.json(data)
  } catch (e) {
    const status = Number(e?.status) || 500
    const payload = { ok: false, message: e?.message || 'compose failed' }
    if (e?.meta) payload.detail = e.meta
    console.error('[compose:/] error:', e?.message, e?.meta || '')
    return res.status(status).json(payload)
  }
})

// 5가지 배경 합성 전용 엔드포인트
router.post('/5bg', async (req, res) => {
  try {
    const { job_id, car_code } = req.body || {}
    if (!job_id && !car_code) {
      return res.status(400).json({ ok: false, message: 'job_id 또는 car_code 중 하나는 필수' })
    }
    const data = await runCompose({ job_id, car_code })
    return res.json(data)
  } catch (e) {
    const status = Number(e?.status) || 500
    const payload = { ok: false, message: e?.message || 'compose failed' }
    if (e?.meta) payload.detail = e.meta
    console.error('[compose:/5bg] error:', e?.message, e?.meta || '')
    return res.status(status).json(payload)
  }
})

// 헬스/디버그
router.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    now: new Date().toISOString(),
    storage: STORAGE
  })
})

export default router
