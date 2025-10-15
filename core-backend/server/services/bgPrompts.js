import { llmBackgroundPrompts } from './openai.js'
export async function getFiveBackgroundPrompts({ car_code }) {
	const ctx = `car_code=${car_code}. Avoid any text in background.`
	const list = await llmBackgroundPrompts(ctx)
	const fallback = [
		'스튜디오 소프트박스 조명, 중성 회색 그라데이션',
		'흐린 하늘 야외 주차장, 젖은 아스팔트 반사',
		'야간 도심 네온, 보케 하이라이트',
		'화이트 쇼룸, 라인 조명, 무광 바닥',
		'숲 가장자리 도로, 아침 안개 역광',
	]
	return list.length === 5 ? list : fallback.slice(0, 5)
}
