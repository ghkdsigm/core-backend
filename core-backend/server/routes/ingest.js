// 코드 주석에 이모티콘은 사용하지 마세요.
import express from 'express'
import path from 'path'
import fs from 'fs'
import unzipper from 'unzipper'

const router = express.Router()
const STORAGE = path.resolve('storage/seq')

router.post('/upload', async (req, res) => {
	const jobId = `JOB-${Date.now()}`
	const dir = path.join(STORAGE, jobId)
	fs.mkdirSync(dir, { recursive: true })

	// zip 스트림 해제
	const extract = unzipper.Extract({ path: dir })
	req.pipe(extract)
	extract.on('close', () => {
		const manifestPath = path.join(dir, 'manifest.json')
		if (!fs.existsSync(manifestPath)) {
			return res.status(400).json({ error: 'manifest missing' })
		}
		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

		// 시퀀스 경로 보장
		const seqDir = path.join(dir, 'seq')
		if (!fs.existsSync(seqDir)) {
			return res.status(400).json({ error: 'seq folder missing' })
		}
		res.json({ job_id: jobId, manifest, seq_dir: seqDir })
	})
})

export default router
