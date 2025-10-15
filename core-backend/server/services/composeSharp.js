import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { generateBackgroundImage } from './openai.js'

export async function composeFiveVariants({ job_dir, seq_dir, car_code, out_root }) {
	const frames = fs
		.readdirSync(seq_dir)
		.filter(f => f.match(/\.(jpg|jpeg|webp|png)$/i))
		.sort()
	if (!frames.length) throw new Error('no frames')
	const src = path.join(seq_dir, frames[Math.floor(frames.length / 2)])

	const outDir = path.resolve(out_root, car_code)
	fs.mkdirSync(outDir, { recursive: true })

	const prompts = JSON.parse(fs.readFileSync(path.join(job_dir, 'bg_prompts.json'), 'utf-8'))

	const results = []
	for (let i = 0; i < prompts.length; i++) {
		const p = prompts[i]
		const bgBuf = await generateBackgroundImage(
			`자동차 제품 사진 배경만 생성. 자동차는 포함하지 말 것. ${p}`,
			1920,
			1080,
		)
		const bg = sharp(bgBuf)
		const bgMeta = await bg.metadata()
		const carBuf = await sharp(src)
			.resize({ width: bgMeta.width || 1920 })
			.toBuffer()

		const outFile = path.join(outDir, `variant_${i + 1}.jpg`)
		const composed = await bg
			.composite([{ input: carBuf, gravity: 'center' }])
			.jpeg({ quality: 90 })
			.toBuffer()
		fs.writeFileSync(outFile, composed)

		results.push({ variant: `v${i + 1}`, prompt: p, file_url: outFile, thumb_url: outFile })
	}
	return results
}
