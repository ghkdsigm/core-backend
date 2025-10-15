// server/routes/ingest.js
// 코드 주석에 이모티콘은 사용하지 마세요.
import express from 'express'
import path from 'path'
import fs from 'fs'
import unzipper from 'unzipper'

const router = express.Router()

// 업로드 원본 시퀀스 저장 루트와, 파노라마(스핀 뷰) 뷰어 산출물 저장 루트
const SEQ_ROOT = path.resolve('storage/seq')
const RENDERS_ROOT = path.resolve('storage/renders')
fs.mkdirSync(SEQ_ROOT, { recursive: true })
fs.mkdirSync(RENTERS_ROOT_SAFE(), { recursive: true })

function RENTERS_ROOT_SAFE() {
  // 오타 방지용 헬퍼. 기존 코드와의 합치성을 위해 RENDERS_ROOT를 보장한다.
  return RENDERS_ROOT
}

// 간단한 스핀 뷰어 번들 생성기
function writeSpinViewerBundle({ outDir, frames, ext = 'jpg', carCode, jobId, startIndex = 1 }) {
	fs.mkdirSync(outDir, { recursive: true });
  
	const indexHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"/>
  <title>${carCode || ''} 360 Spin</title><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>html,body{margin:0;background:#0b0b0b;color:#ddd}#wrap{max-width:1200px;margin:0 auto;padding:12px}
  canvas{width:100%;height:auto;background:#111;border:1px solid #222;border-radius:8px}</style>
  </head><body><div id="wrap"><h3>360° Spin ${carCode ? '- ' + carCode : ''}</h3>
  <canvas id="cv" width="960" height="540"></canvas></div>
  <script src="./viewer.js"></script></body></html>`;
  
	// base를 절대경로로 고정, 시작 인덱스(0/1) 지원
	const viewerJs = `// 코드 주석에 이모티콘은 사용하지 마세요.
  (function(){
	const cv=document.getElementById("cv"), cx=cv.getContext("2d");
	const frames=${Number(frames)||0}, ext="${ext}";
	const base="/seq-static/${jobId}/seq";
	const startIndex=${startIndex}; // 0 또는 1
	const imgs=new Array(frames); let cur=0, drag=false, lastX=0, loaded=0;
  
	function pad3(n){ return String(n).padStart(3,"0"); }
	function urlOf(i){ const n=pad3(i + startIndex); return base + "/frame_" + n + "." + ext; }
  
	function draw(i){
	  const im=imgs[i]; if(!im) return;
	  const w=cv.width, h=cv.height, iw=im.naturalWidth||im.width, ih=im.naturalHeight||im.height;
	  const s=Math.min(w/iw,h/ih), dw=(iw*s)|0, dh=(ih*s)|0, dx=((w-dw)/2)|0, dy=((h-dh)/2)|0;
	  cx.clearRect(0,0,w,h); cx.drawImage(im,dx,dy,dw,dh);
	}
	function set(i){ cur=(i%frames+frames)%frames; if(imgs[cur]?.complete) draw(cur); }
  
	for(let i=0;i<frames;i++){
	  const im=new Image(); im.decoding="async"; im.src=urlOf(i);
	  im.onload=()=>{ if(++loaded===1) draw(0); };
	  imgs[i]=im;
	}
  
	function down(e){ drag=true; lastX=("touches" in e? e.touches[0].clientX:e.clientX); e.preventDefault(); }
	function move(e){ if(!drag) return; const x=("touches" in e? e.touches[0].clientX:e.clientX), dx=x-lastX; lastX=x;
	  if(Math.abs(dx)>1){ set(cur + (dx>0?-1:1)); } e.preventDefault(); }
	function up(){ drag=false; }
	function wheel(e){ set(cur + (e.deltaY>0?1:-1)); e.preventDefault(); }
  
	cv.addEventListener("mousedown",down); window.addEventListener("mouseup",up); cv.addEventListener("mousemove",move);
	cv.addEventListener("touchstart",down,{passive:false}); window.addEventListener("touchend",up);
	cv.addEventListener("touchmove",move,{passive:false}); cv.addEventListener("wheel",wheel,{passive:false});
  
	function resize(){ const r=cv.getBoundingClientRect(); const w=Math.max(480, r.width|0), h=(w*9/16)|0; cv.width=w; cv.height=h; draw(cur); }
	window.addEventListener("resize",resize); resize();
  })();`;
  
	fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml);
	fs.writeFileSync(path.join(outDir, 'viewer.js'), viewerJs);
	fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ frames, ext, job_id: jobId, start_index: startIndex }, null, 2));
  }

// 업로드: ZIP 스트림을 받아 JOB 디렉터리에 해제하고, 곧바로 스핀 뷰어 생성까지 자동 수행
router.post('/upload', async (req, res) => {
  try {
    const jobId = `JOB-${Date.now()}`
    const jobDir = path.join(SEQ_ROOT, jobId)
    fs.mkdirSync(jobDir, { recursive: true })

    const extract = unzipper.Extract({ path: jobDir })

    extract.on('error', (err) => {
      console.error('[ingest:/upload] extract error:', err)
      try { fs.rmSync(jobDir, { recursive: true, force: true }) } catch {}
      return res.status(400).json({ ok: false, message: 'invalid zip' })
    })

    extract.on('close', () => {
		try {
			const manifestPath = path.join(jobDir, 'manifest.json')
			if (!fs.existsSync(manifestPath)) {
			return res.status(400).json({ ok: false, message: 'manifest missing' })
			}
			const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
		
			const seqDir = path.join(jobDir, 'seq')
			if (!fs.existsSync(seqDir)) {
			return res.status(400).json({ ok: false, message: 'seq folder missing' })
			}
		
			const carCode = manifest.car_code || jobId
			const frames = Number(manifest.frames || 0)
			const ext = manifest.ext || 'jpg'
		
			// 파일 네이밍이 000부터인지 001부터인지 자동 판별
			const has000 = fs.existsSync(path.join(seqDir, `frame_000.${ext}`))
			const has001 = fs.existsSync(path.join(seqDir, `frame_001.${ext}`))
			const startIndex = has000 ? 0 : 1  // 000 있으면 0, 아니면 1
		
			const viewerOutDir = path.join(RENTERS_ROOT_SAFE(), carCode, 'viewer')
			try {
			writeSpinViewerBundle({ outDir: viewerOutDir, frames, ext, carCode, jobId, startIndex })
			} catch (e) {
			console.error('[ingest:/upload] viewer generation failed:', e)
			}
		
			const viewerUrl = `/viewer-static/${encodeURIComponent(carCode)}/viewer/`
		
			return res.json({
			ok: true,
			job_id: jobId,
			manifest,
			seq_dir: seqDir,
			viewer_dir: viewerOutDir,
			viewer_url: viewerUrl
			})
		} catch (e) {
			console.error('[ingest:/upload] post-validate error:', e)
			return res.status(500).json({ ok: false, message: e?.message || 'ingest failed' })
		}
	})

    req.pipe(extract)
  } catch (e) {
    console.error('[ingest:/upload] error:', e)
    return res.status(500).json({ ok: false, message: e?.message || 'ingest failed' })
  }
})

export default router
