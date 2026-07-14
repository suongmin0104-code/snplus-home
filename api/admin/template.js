import { Readable } from "node:stream";

import { get } from "@vercel/blob";

import { requireAdmin, sendJson } from "../../lib/admin-auth.js";

const templates = Object.freeze({
  estimate: {
    pathname: "admin-templates/estimate-template.xls",
    downloadName: "에스앤_견적서_양식.xls"
  },
  transaction: {
    pathname: "admin-templates/transaction-statement-template.xls",
    downloadName: "에스앤_거래명세서_양식.xls"
  }
});

function attachmentHeader(fileName) {
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="sn-template.xls"; filename*=UTF-8''${encoded}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  }

  const auth = requireAdmin(req, res);
  if (!auth) return;

  const key = String(req.query?.file ?? "").trim();
  const template = templates[key];
  if (!template) {
    return sendJson(res, 404, { ok: false, message: "요청한 업무 서식을 찾을 수 없습니다." });
  }

  try {
    const result = await get(template.pathname, { access: "private" });
    if (result?.statusCode !== 200 || !result.stream) {
      return sendJson(res, 404, { ok: false, message: "업무 서식 원본을 찾을 수 없습니다." });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", result.blob.contentType || "application/vnd.ms-excel");
    if (Number.isFinite(result.blob.size)) {
      res.setHeader("Content-Length", String(result.blob.size));
    }
    res.setHeader("Content-Disposition", attachmentHeader(template.downloadName));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    Readable.fromWeb(result.stream).pipe(res);
  } catch (error) {
    console.error("ADMIN_TEMPLATE_BLOB_FAILED", error?.message ?? error);
    return sendJson(res, 503, { ok: false, message: "업무 서식 저장소에 연결하지 못했습니다." });
  }
}
