import 'dotenv/config' // <- 이 줄 추가 (중요)

import OpenAI from 'openai'
const client = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
})

// 이하 동일...
export async function llmBackgroundPrompts(context) {
	const sys =
		'You are a creative photo art director. Return exactly 5 short background styles for car product shots. No extra prose.'
	const user = `Make 5 distinct background prompts for a car product photo. 
- Keep car untouched; backgrounds must be photorealistic.
- Styles should differ in lighting, mood, environment.
- Each in <= 18 Korean words if possible.
Context: ${context}`

	const res = await client.chat.completions.create({
		model: 'gpt-4o-mini',
		messages: [
			{ role: 'system', content: sys },
			{ role: 'user', content: user },
		],
		temperature: 0.9,
	})
	const txt = res.choices[0]?.message?.content || ''
	return txt
		.split(/\r?\n/)
		.map(s => s.replace(/^\s*[-*•\d.]+\s*/, '').trim())
		.filter(Boolean)
		.slice(0, 5)
}

export async function generateBackgroundImage(prompt, width = 1920, height = 1080) {
	const res = await client.images.generate({
		model: 'gpt-image-1',
		prompt,
		size: `${width}x${height}`,
	})
	const b64 = res.data[0].b64_json
	return Buffer.from(b64, 'base64')
}
