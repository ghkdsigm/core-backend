// 코드 주석에 이모티콘은 사용하지 마세요.
import express from "express";
import fs from "fs";
import path from "path";
import archiver from "archiver";

const router = express.Router();
const STORAGE = {
  seq: path.resolve("storage/seq"),
  renders: path.resolve("storage/renders")
};

// 간단 뷰어 자원
function viewerIndexHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"/>
<title>Spin Viewer</title><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>html,body{margin:0;background:#0b0b0b;color:#ddd}#wrap{max-width:1200px;margin:0 auto;padding:12px}
canvas{width:100%;height:auto;background:#111;border:1px solid #222;border-radius:8px}</style>
</head><body><div id="wrap"><h3>360° Spin</h3><canvas id="cv" width="960" height="540"></canvas></div>
<script src="./viewer.js"></script></body></html>`;
}

function viewerJs() {
  return `// 코드 주석에 이모티콘은 사용하지 마세요.
(async function(){
  const q = new URLSearchParams(location.search);
  const resp = await fetch("./manifest.json");
  const m = await resp.json();
  const base = q.get("base") || "../seq";
  const cv = document.getElementById("cv");
  const cx = cv.getContext("2d");
  const imgs = new Array(m.frames);
  let cur=0, drag=false, lastX=0, loaded=0;

  function urlOf(i){
    const n = String(i+1).padStart(3,"0");
    return base + "/frame_" + n + "." + m.ext;
  }
  function draw(i){
    const im = imgs[i]; if(!im) return;
    const w=cv.width, h=cv.height, iw=im.naturalWidth||im.width, ih=im.naturalHeight||im.height;
    const s=Math.min(w/iw,h/ih), dw=(iw*s)|0, dh=(ih*s)|0, dx=((w-dw)/2)|0, dy=((h-dh)/2)|0;
    cx.clearRect(0,0,w,h); cx.drawImage(im,dx,dy,dw,dh);
  }
  function set(i){ cur=(i%m.frames+m.frames)%m.frames; if(imgs[cur]?.complete) draw(cur); }

  for(let i=0;i<m.frames;i++){
    const im=new Image(); im.decoding="async"; im.src=urlOf(i);
    im.onload=()=>{ if(++loaded===1) draw(0); };
    imgs[i]=im;
  }

  function down(e){ drag=true; lastX=("touches" in e? e.touches[0].clientX : e.clientX); e.preventDefault(); }
  function move(e){ if(!drag) return; const x=("touches" in e? e.touches[0].clientX : e.clientX); const dx=x-lastX; lastX=x;
    if(Math.abs(dx)>1){ set(cur + (dx>0?-1:1)); } e.preventDefault(); }
  function up(){ drag=false; }
  function wheel(e){ set(cur + (e.deltaY>0?1:-1)); e.preventDefault(); }

  cv.addEventListener("mousedown",down); window.addEventListener("mouseup",up); cv.addEventListener("mousemove",move);
  cv.addEventListener("touchstart",down,{passive:false}); window.addEventListener("touchend",up);
  cv.addEventListener("touchmove",move,{passive:false}); cv.addEventListener("wheel",wheel,{passive:false});

  function resize(){ const r=cv.getBoundingClientRect(); const w=Math.max(480,r.width|0), h=(w*9/16)|0; cv.width=w; cv.height=h; draw(cur); }
  window.addEventListener("resize",resize); resize();
})();`;
}

// 1) 뷰어 생성: renders/<car_code>/viewer 에 파일 생성
router.post("/spin", async (req, res) => {
  try{
    const { job_id, car_code } = req.body || {};
    if(!job_id || !car_code) return res.status(400).json({ error:"job_id, car_code required" });

    const jobDir = path.join(STORAGE.seq, job_id);
    const manifestPath = path.join(jobDir, "manifest.json");
    const seqDir = path.join(jobDir, "seq");
    if(!fs.existsSync(manifestPath) || !fs.existsSync(seqDir)) return res.status(404).json({ error:"manifest or seq missing" });

    const man = JSON.parse(fs.readFileSync(manifestPath,"utf-8"));
    const outDir = path.join(STORAGE.renders, car_code, "viewer");
    fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ frames: man.frames, ext: man.ext || "jpg" }, null, 2));
    fs.writeFileSync(path.join(outDir, "index.html"), viewerIndexHtml());
    fs.writeFileSync(path.join(outDir, "viewer.js"), viewerJs());

    return res.json({ ok:true, car_code, out: outDir });
  }catch(e){
    return res.status(500).json({ error:e.message });
  }
});

// 2) 번들(zip) 다운로드
router.get("/:car_code/bundle.zip", async (req, res) => {
  const { car_code } = req.params;
  const dir = path.join(STORAGE.renders, car_code, "viewer");
  if(!fs.existsSync(dir)) return res.status(404).send("not found");

  res.setHeader("Content-Type","application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${car_code}-viewer.zip"`);

  const archive = archiver("zip", { zlib:{ level:9 } });
  archive.on("error", err => res.status(500).end(String(err)));
  archive.pipe(res);
  archive.directory(dir, "/");
  archive.finalize();
});

export default router;
