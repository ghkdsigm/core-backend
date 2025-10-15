// server/routes/viewer.js
// 코드 주석에 이모티콘은 사용하지 마세요.
import express from "express";
import fs from "fs";
import path from "path";
import archiver from "archiver";

const router = express.Router();

const STORAGE = {
  seq: path.resolve("storage/seq"),
  renders: path.resolve("storage/renders"),
};

/**
 * 뷰어 index.html 템플릿
 * - viewer.js를 로드하고, 캔버스만 갖춘 최소 HTML
 */
function viewerIndexHtml({ carCode }) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"/>
<title>${carCode || ""} 360 Spin</title><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  html,body{margin:0;background:#0b0b0b;color:#ddd}
  #wrap{max-width:1200px;margin:0 auto;padding:12px}
  canvas{width:100%;height:auto;background:#111;border:1px solid #222;border-radius:8px}
</style>
</head>
<body>
  <div id="wrap">
    <h3>360° Spin${carCode ? " - " + carCode : ""}</h3>
    <canvas id="cv" width="960" height="540"></canvas>
  </div>
  <script src="./viewer.js"></script>
</body></html>`;
}

/**
 * 뷰어 JS 템플릿
 * - manifest.json을 읽어 frames, ext, job_id, start_index를 사용
 * - base를 /seq-static/<job_id>/seq 로 고정(절대경로)
 * - devicePixelRatio 반영하여 선명도 개선
 */
function viewerJs() {
  return `// 코드 주석에 이모티콘은 사용하지 마세요.
(async function(){
  const cv = document.getElementById("cv");
  const cx = cv.getContext("2d");

  // manifest.json 로드
  const m = await fetch("./manifest.json").then(r=>r.json());
  const frames = Number(m.frames||0);
  const ext = m.ext || "jpg";
  const jobId = m.job_id;
  const startIndex = Number(m.start_index||1); // 0 또는 1
  const base = "/seq-static/" + encodeURIComponent(jobId) + "/seq";

  const imgs = new Array(frames);
  let cur = 0, drag = false, lastX = 0, loaded = 0;

  function pad3(n){ return String(n).padStart(3,"0"); }
  function urlOf(i){ return base + "/frame_" + pad3(i + startIndex) + "." + ext; }

  function ensureCanvasSize(){
    const rect = cv.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.max(480, Math.floor(rect.width)) * dpr;
    const H = Math.floor(W * 9 / 16);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W; cv.height = H;
      return true;
    }
    return false;
  }

  function draw(i){
    const im = imgs[i]; if(!im) return;
    const changed = ensureCanvasSize();
    const W = cv.width, H = cv.height;
    const iw = im.naturalWidth||im.width, ih = im.naturalHeight||im.height;
    const s = Math.min(W/iw, H/ih), dw = (iw*s)|0, dh = (ih*s)|0;
    const dx = ((W - dw)/2)|0, dy = ((H - dh)/2)|0;
    cx.clearRect(0,0,W,H);
    cx.drawImage(im, dx, dy, dw, dh);
  }
  function set(i){ cur = (i%frames + frames) % frames; if (imgs[cur]?.complete) draw(cur); }

  // 프레임 프리로드
  for (let i=0;i<frames;i++){
    const im = new Image();
    im.decoding = "async";
    im.onload = () => { if (++loaded === 1) draw(0); };
    im.onerror = () => { /* 프레임 누락 시 무시 */ };
    im.src = urlOf(i);
    imgs[i] = im;
  }

  // 제스처
  function down(e){ drag = true; lastX = ("touches" in e ? e.touches[0].clientX : e.clientX); e.preventDefault(); }
  function move(e){
    if(!drag) return;
    const x = ("touches" in e ? e.touches[0].clientX : e.clientX);
    const dx = x - lastX; lastX = x;
    if (Math.abs(dx) > 1) set(cur + (dx>0 ? -1 : 1));
    e.preventDefault();
  }
  function up(){ drag = false; }
  function wheel(e){ set(cur + (e.deltaY>0 ? 1 : -1)); e.preventDefault(); }

  cv.addEventListener("mousedown", down);
  window.addEventListener("mouseup", up);
  cv.addEventListener("mousemove", move);
  cv.addEventListener("touchstart", down, { passive:false });
  window.addEventListener("touchend", up);
  cv.addEventListener("touchmove", move, { passive:false });
  cv.addEventListener("wheel", wheel, { passive:false });

  window.addEventListener("resize", () => draw(cur));
  ensureCanvasSize();
})();`;
}

/**
 * 스핀 뷰어 산출물 생성
 * - frames/ext은 manifest.json에서 읽음
 * - start_index는 frame_000 또는 frame_001 존재로 판별
 * - viewer 디렉터리에 index.html, viewer.js, manifest.json 생성
 */
function generateViewerFiles({ jobId, carCode }) {
  const jobDir = path.join(STORAGE.seq, jobId);
  const manifestPath = path.join(jobDir, "manifest.json");
  const seqDir = path.join(jobDir, "seq");
  if (!fs.existsSync(manifestPath) || !fs.existsSync(seqDir)) {
    throw new Error("manifest or seq missing");
  }

  const man = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const frames = Number(man.frames || 0);
  const ext = man.ext || "jpg";

  // 시작 인덱스 판별(000 또는 001)
  const has000 = fs.existsSync(path.join(seqDir, `frame_000.${ext}`));
  const startIndex = has000 ? 0 : 1;

  const outDir = path.join(STORAGE.renders, carCode, "viewer");
  fs.mkdirSync(outDir, { recursive: true });

  // 파일 기록
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ frames, ext, job_id: jobId, start_index: startIndex }, null, 2)
  );
  fs.writeFileSync(path.join(outDir, "index.html"), viewerIndexHtml({ carCode }));
  fs.writeFileSync(path.join(outDir, "viewer.js"), viewerJs());

  return { outDir, frames, ext, startIndex };
}

// 1) 뷰어 생성: renders/<car_code>/viewer 에 파일 생성
router.post("/spin", async (req, res) => {
  try {
    const { job_id, car_code } = req.body || {};
    if (!job_id || !car_code) {
      return res.status(400).json({ error: "job_id, car_code required" });
    }
    const r = generateViewerFiles({ jobId: job_id, carCode: car_code });
    return res.json({ ok: true, car_code, out: r.outDir, frames: r.frames, start_index: r.startIndex });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// 2) 번들(zip) 다운로드
router.get("/:car_code/bundle.zip", async (req, res) => {
  const { car_code } = req.params;
  const dir = path.join(STORAGE.renders, car_code, "viewer");
  if (!fs.existsSync(dir)) return res.status(404).send("not found");

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${car_code}-viewer.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", err => res.status(500).end(String(err)));
  archive.pipe(res);
  archive.directory(dir, "/");
  archive.finalize();
});

export default router;
