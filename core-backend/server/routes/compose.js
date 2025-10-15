import express from 'express'
import path from 'path'
import fs from 'fs'
import { getFiveBackgroundPrompts } from '../services/bgPrompts.js'
import { composeFiveVariants } from '../services/composeSharp.js'

const router = express.Router()
const STORAGE = {
	seq: path.resolve('storage/seq'),
	renders: path.resolve('storage/renders'),
}

router.post('/5bg', async (req, res) => {
	try {
		const { job_id, car_code } = req.body || {}
		if (!job_id || !car_code) return res.status(400).json({ error: 'job_id, car_code required' })

		const jobDir = path.join(STORAGE.seq, job_id)
		const seqDir = path.join(jobDir, 'seq')
		if (!fs.existsSync(seqDir)) return res.status(404).json({ error: 'seq not found' })

		const prompts = await getFiveBackgroundPrompts({ car_code })
		fs.writeFileSync(path.join(jobDir, 'bg_prompts.json'), JSON.stringify(prompts, null, 2))

		const results = await composeFiveVariants({
			job_dir: jobDir,
			seq_dir: seqDir,
			car_code,
			out_root: STORAGE.renders,
		})

		res.json({ ok: true, car_code, job_id, results })
	} catch (e) {
		res.status(500).json({ error: e.message })
	}
})

export default router
