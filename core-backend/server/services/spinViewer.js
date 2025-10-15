// 코드 주석에 이모티콘은 사용하지 마세요.
import fs from "fs";
import path from "path";

export async function generateSpinViewer({ storageRoot, jobId, carCode }) {
  const seqDir = path.join(storageRoot, "seq", jobId, "seq");
  const manifestPath = path.join(storageRoot, "seq", jobId, "manifest.json");
  if (!fs.existsSync(seqDir) || !fs.existsSync(manifestPath)) {
    throw new Error("manifest or seq missing");
  }
  const man = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const frames = Number(man.frames || 0);
  const ext = man.ext || "jpg";
  const outDir = path.join(storageRoot, "renders", carCode, "viewer");
  fs.mkdirSync(outDir, { recursive: true });

  const indexHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"/>
<title>${carCode} 360 Spin</title><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>html,body{margin:0;background:#0b0b0b;color:#ddd}#wrap{max-width:1200px;margin:0 auto;padding:12px}
canvas{width:100%;height:auto;background:#111;border:1px solid #222;border-radius:8px}</style>
</head><body><div id="wrap"><h3>360° Spin - ${carCode}</h3><canvas id="cv" width="960" height="540"></canvas></div>
<script src="./viewer.js"></script></body></html>`;
  const viewerJs = `// 코드 주석에 이모티콘은 사용하지 마세요.
(async function(){
  const cv=document.getElementById("cv"), cx=cv.getContext("2d");
  const m={ frames:${frames}, ext:"${ext}" };
  const base="../seq"; // seq는 job 디렉토리에 있음. 서버에서 /viewer-static로 매핑.
  const imgs=new Array(m.frames); let cur=0, drag=false, lastX=0, loaded=0;
  function urlOf(i){ const n=String(i+1).padStart(3,"0"); return base + "/frame_"+n+"."+m.ext; }
  function draw(i){
    const im=imgs[i]; if(!im) return;
    const w=cv.width,h=cv.height, iw=im.naturalWidth||im.width, ih=im.naturalHeight||im.height;
    const s=Math.min(w/iw,h/ih), dw=(iw*s)|0, dh=(ih*s)|0, dx=((w-dw)/2)|0, dy=((h-dh)/2)|0;
    cx.clearRect(0,0,w,h); cx.drawImage(im,dx,dy,dw,dh);
  }
  function set(i){ cur=(i%m.frames+m.frames)%m.frames; if(imgs[cur]?.complete) draw(cur); }
  for(let i=0;i<m.frames;i++){ const im=new Image(); im.decoding="async"; im.src=urlOf(i);
    im.onload=()=>{ if(++loaded===1) draw(0); }; imgs[i]=im; }
  function down(e){ drag=true; lastX=("touches" in e? e.touches[0].clientX:e.clientX); e.preventDefault();}
  function move(e){ if(!drag) return; const x=("touches" in e? e.touches[0].clientX:e.clientX), dx=x-lastX; lastX=x;
    if(Math.abs(dx)>1){ set(cur + (dx>0?-1:1)); } e.preventDefault();}
  function up(){ drag=false; }
  function wheel(e){ set(cur + (e.deltaY>0?1:-1)); e.preventDefault();}
  cv.addEventListener("mousedown",down); window.addEventListener("mouseup",up); cv.addEventListener("mousemove",move);
  cv.addEventListener("touchstart",down,{passive:false}); window.addEventListener("touchend",up);
  cv.addEventListener("touchmove",move,{passive:false}); cv.addEventListener("wheel",wheel,{passive:false});
  function resize(){ const r=cv.getBoundingClientRect(); const w=Math.max(480, r.width|0), h=(w*9/16)|0; cv.width=w; cv.height=h; draw(cur); }
  window.addEventListener("resize",resize); resize();
})();`;

  fs.writeFileSync(path.join(outDir, "index.html"), indexHtml);
  fs.writeFileSync(path.join(outDir, "viewer.js"), viewerJs);

  return { outDir, frames, ext };
}
