// server/routes/insta360.js
// 코드 주석에 이모티콘은 사용하지 마세요.
import express from "express";
import fs from "fs";
import path from "path";
import { captureSingleImage } from "../services/insta360.js";

const router = express.Router();

// 이미지 저장 디렉터리를 static 서빙
const STORAGE_DIR = path.resolve("storage", "insta360");
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
router.use("/images", express.static(STORAGE_DIR));

/**
 * POST /insta360/capture
 * body: { car_code?: string }
 */
router.post("/capture", async (req, res) => {
  try {
    const body = req.body || {};
    const carCode = body.car_code || body.carCode || "";

    const result = await captureSingleImage({ carCode });

    return res.json({
      ok: true,
      url: result.publicUrlPath, // 예: /insta360/images/20251126_123456_ABC123.jpg
      info: result.cameraInfo,
      state: result.cameraState,
    });
  } catch (err) {
    console.error("[insta360] capture error:", err);
    return res.status(500).json({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  }
});

export default router;
