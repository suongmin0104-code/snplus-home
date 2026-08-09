import { Readable } from "node:stream";

import { get } from "@vercel/blob";

import { requireAdmin, sendJson } from "../../lib/admin-auth.js";
import { isContactPhotoPath } from "../../lib/contact-store.js";

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res, "estimate");
  if (!auth) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  }

  const path = String(req.query?.path ?? "").trim();
  if (!isContactPhotoPath(path)) {
    return sendJson(res, 404, { ok: false, message: "현장사진을 찾을 수 없습니다." });
  }

  try {
    const result = await get(path, { access: "private", useCache: false });
    if (!result?.stream) {
      return sendJson(res, 404, { ok: false, message: "현장사진을 찾을 수 없습니다." });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", result.blob.contentType || "image/jpeg");
    if (Number.isFinite(result.blob.size)) res.setHeader("Content-Length", String(result.blob.size));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    Readable.fromWeb(result.stream).pipe(res);
  } catch (error) {
    console.error("ADMIN_CONTACT_PHOTO_FAILED", error?.message ?? error);
    return sendJson(res, 500, { ok: false, message: "현장사진을 불러오지 못했습니다." });
  }
}
