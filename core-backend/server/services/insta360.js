// server/services/insta360.js
// 코드 주석에 이모티콘은 사용하지 마세요.
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const CAMERA_HOST = process.env.INSTA360_HOST || "192.168.42.1";
const CAMERA_BASE = `http://${CAMERA_HOST}`;
const STORAGE_DIR = path.resolve("storage", "insta360");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function oscGet(p) {
  const url = `${CAMERA_BASE}${p}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(`OSC GET ${p} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return data;
}

async function oscPost(p, body) {
  const url = `${CAMERA_BASE}${p}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Accept: "application/json",
      "X-XSRF-Protected": "1",
    },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(`OSC POST ${p} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return data;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Insta360에서 단일 360 이미지를 촬영하고 서버에 저장
 * @param {{ carCode?: string }} param0
 * @returns {{ filePath: string, publicUrlPath: string, cameraInfo: any, cameraState: any }}
 */
export async function captureSingleImage({ carCode } = {}) {
  ensureDir(STORAGE_DIR);

  // 1) 카메라 정보 및 상태 확인 (필수는 아니지만 디버깅용으로 유용)
  const info = await oscGet("/osc/info");
  const state = await oscPost("/osc/state", {});

  // 2) 이미지 모드 + 온디바이스 스티칭 설정 시도
  try {
    await oscPost("/osc/commands/execute", {
      name: "camera.setOptions",
      parameters: {
        options: {
          captureMode: "image",
          hdr: "off",
          photoStitching: "ondevice", // 지원 안 하면 아래 catch에서 fallback
        },
      },
    });
  } catch (err) {
    // photoStitching 미지원 카메라용 fallback
    await oscPost("/osc/commands/execute", {
      name: "camera.setOptions",
      parameters: {
        options: {
          captureMode: "image",
          hdr: "off",
        },
      },
    });
  }

  // 3) 촬영 시작
  const takeResp = await oscPost("/osc/commands/execute", {
    name: "camera.takePicture",
  });

  const id = takeResp.id;
  if (!id) {
    throw new Error("camera.takePicture 응답에 id가 없습니다.");
  }

  // 4) 상태 폴링해서 완료될 때까지 대기
  let fileUrl = null;
  const started = Date.now();
  const timeoutMs = 60_000;

  while (true) {
    await sleep(1000);
    const status = await oscPost("/osc/commands/status", { id });

    if (status.state === "done") {
      if (status.results) {
        if (status.results.fileUrl) {
          fileUrl = status.results.fileUrl;
        } else if (
          Array.isArray(status.results._fileGroup) &&
          status.results._fileGroup.length > 0
        ) {
          fileUrl = status.results._fileGroup[0];
        }
      }
      break;
    }

    if (Date.now() - started > timeoutMs) {
      throw new Error("takePicture 타임아웃");
    }
  }

  if (!fileUrl) {
    throw new Error("status 결과에 fileUrl이 없습니다.");
  }

  // 5) fileUrl로 실제 이미지 다운로드
  const imgRes = await fetch(fileUrl);
  if (!imgRes.ok) {
    const text = await imgRes.text();
    throw new Error(`이미지 다운로드 실패: ${imgRes.status} ${text.slice(0, 200)}`);
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());

  // 6) 서버 로컬에 저장
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const safeCarCode = carCode ? carCode.replace(/[^a-zA-Z0-9_-]/g, "_") : "nocode";
  const filename = `${stamp}_${safeCarCode}.jpg`;
  const filePath = path.join(STORAGE_DIR, filename);
  fs.writeFileSync(filePath, buf);

  // 7) 공개용 URL path (실제 서빙은 라우터에서 static으로 처리)
  const publicUrlPath = `/insta360/images/${filename}`;

  return { filePath, publicUrlPath, cameraInfo: info, cameraState: state };
}
