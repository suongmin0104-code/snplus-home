import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { del, get, put } from "@vercel/blob";

import { requireAdmin, sendJson } from "../../lib/admin-auth.js";
import { isWorklogId, isWorklogPhotoPath, WORKLOG_PHOTO_PREFIX } from "../../lib/worklog-store.js";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const CONTENT_TYPES = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
});

async function readBinaryBody(req) {
  const announcedLength = Number(req.headers?.["content-length"] ?? 0);
  if (announcedLength > MAX_PHOTO_BYTES) {
    throw new Error("PHOTO_TOO_LARGE");
  }

  let parsedBody = null;
  if (Buffer.isBuffer(req.body)) parsedBody = req.body;
  else if (req.body instanceof Uint8Array) parsedBody = Buffer.from(req.body);
  else if (req.body instanceof ArrayBuffer) parsedBody = Buffer.from(req.body);
  else if (typeof req.body === "string") parsedBody = Buffer.from(req.body, "binary");
  if (parsedBody) {
    if (parsedBody.length > MAX_PHOTO_BYTES) throw new Error("PHOTO_TOO_LARGE");
    return parsedBody;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_PHOTO_BYTES) throw new Error("PHOTO_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function matchesImageSignature(buffer, contentType) {
  if (contentType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/webp") {
    return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

function safeFileName(value) {
  let decoded = String(value ?? "현장사진");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the original header value when it is not URI encoded.
  }
  return decoded.replace(/[\r\n"\\/]/g, "").trim().slice(0, 120) || "현장사진";
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res, "worklog");
  if (!auth) return;

  const path = String(req.query?.path ?? "").trim();

  try {
    if (req.method === "GET") {
      if (!isWorklogPhotoPath(path)) {
        return sendJson(res, 404, { ok: false, message: "사진을 찾을 수 없습니다." });
      }

      const result = await get(path, { access: "private", useCache: false });
      if (!result?.stream) {
        return sendJson(res, 404, { ok: false, message: "사진을 찾을 수 없습니다." });
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", result.blob.contentType || "image/jpeg");
      if (Number.isFinite(result.blob.size)) res.setHeader("Content-Length", String(result.blob.size));
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("X-Content-Type-Options", "nosniff");
      Readable.fromWeb(result.stream).pipe(res);
      return;
    }

    if (req.method === "POST") {
      const entryId = String(req.query?.entryId ?? "").trim();
      const contentType = String(req.headers?.["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      const extension = CONTENT_TYPES[contentType];

      if (!isWorklogId(entryId) || !extension) {
        return sendJson(res, 400, { ok: false, message: "JPEG, PNG 또는 WEBP 사진만 등록할 수 있습니다." });
      }

      const body = await readBinaryBody(req);
      if (!body.length) {
        return sendJson(res, 400, { ok: false, message: "사진 파일이 비어 있습니다." });
      }
      if (!matchesImageSignature(body, contentType)) {
        return sendJson(res, 400, { ok: false, message: "사진 파일 형식을 확인해 주세요." });
      }

      const photoId = randomUUID();
      const photoPath = `${WORKLOG_PHOTO_PREFIX}${entryId}/${photoId}.${extension}`;
      await put(photoPath, body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType,
        cacheControlMaxAge: 60
      });

      return sendJson(res, 200, {
        ok: true,
        photo: {
          id: photoId,
          path: photoPath,
          name: safeFileName(req.headers?.["x-file-name"]),
          contentType,
          size: body.length,
          uploadedAt: new Date().toISOString()
        }
      });
    }

    if (req.method === "DELETE") {
      if (!isWorklogPhotoPath(path)) {
        return sendJson(res, 400, { ok: false, message: "삭제할 사진 정보가 올바르지 않습니다." });
      }
      await del(path);
      return sendJson(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  } catch (error) {
    console.error("ADMIN_WORKLOG_PHOTO_FAILED", error?.message ?? error);
    const message = error?.message === "PHOTO_TOO_LARGE"
      ? "사진은 한 장당 2MB 이하로 등록해 주세요."
      : "사진을 처리하지 못했습니다.";
    return sendJson(res, 400, { ok: false, message });
  }
}
