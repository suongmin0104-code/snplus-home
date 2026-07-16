import { Readable } from "node:stream";

import { readJsonBody, requireAdmin, sendJson } from "../../lib/admin-auth.js";
import {
  deleteEstimate,
  deleteInventory,
  deleteProduction,
  listEstimates,
  listInventory,
  listInventoryMovements,
  listProduction,
  moveInventory,
  readEstimatePdf,
  saveEstimate,
  saveEstimatePdf,
  saveInventory,
  saveProduction,
  summarizeEstimates,
  summarizeInventory,
  summarizeProduction
} from "../../lib/operations-store.js";
import {
  deleteTaxTask,
  deleteTaxTransaction,
  listTaxTasks,
  listTaxTransactions,
  readTaxForecast,
  saveTaxForecast,
  saveTaxTask,
  saveTaxTransaction,
  summarizeTaxForecast,
  summarizeTaxWorkspace
} from "../../lib/tax-store.js";

const MAX_ESTIMATE_PDF_BYTES = 4 * 1024 * 1024;

const TYPE_PERMISSION = Object.freeze({
  estimate: "estimate",
  production: "production",
  inventory: "inventory",
  "inventory-movement": "inventory",
  tax: "tax",
  "tax-transaction": "tax",
  "tax-task": "tax",
  "tax-forecast": "tax"
});

async function readBinaryBody(req) {
  const announcedLength = Number(req.headers?.["content-length"] ?? 0);
  if (announcedLength > MAX_ESTIMATE_PDF_BYTES) throw new Error("ESTIMATE_PDF_TOO_LARGE");
  let directBody = null;
  if (Buffer.isBuffer(req.body)) directBody = req.body;
  else if (req.body instanceof Uint8Array) directBody = Buffer.from(req.body);
  else if (req.body instanceof ArrayBuffer) directBody = Buffer.from(req.body);
  else if (typeof req.body === "string") directBody = Buffer.from(req.body, "binary");
  if (directBody) {
    if (directBody.length > MAX_ESTIMATE_PDF_BYTES) throw new Error("ESTIMATE_PDF_TOO_LARGE");
    return directBody;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_ESTIMATE_PDF_BYTES) throw new Error("ESTIMATE_PDF_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function isPdf(buffer) {
  return buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-";
}

function safeFileName(value) {
  let decoded = String(value ?? "견적서.pdf");
  try { decoded = decodeURIComponent(decoded); } catch { /* Keep the original header value. */ }
  const clean = decoded.replace(/[\r\n"\\/]/g, "").trim().slice(0, 120) || "견적서.pdf";
  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
}

function errorMessage(error) {
  const messages = {
    ESTIMATE_TITLE_REQUIRED: "견적 제목을 입력해 주세요.",
    ESTIMATE_NOT_FOUND: "먼저 견적서 내용을 저장해 주세요.",
    ESTIMATE_PDF_INVALID: "견적서 PDF 파일을 확인해 주세요.",
    ESTIMATE_PDF_TOO_LARGE: "견적서 PDF는 4MB 이하로 저장해 주세요.",
    PRODUCTION_TITLE_REQUIRED: "생산 작업명을 입력해 주세요.",
    INVENTORY_NAME_REQUIRED: "재고 제품명을 입력해 주세요.",
    INVENTORY_NOT_FOUND: "재고 제품을 찾을 수 없습니다.",
    INVENTORY_MOVEMENT_INVALID: "입고·출고 수량을 정확히 입력해 주세요.",
    INVENTORY_QUANTITY_SHORT: "현재 재고보다 많이 출고할 수 없습니다.",
    OPERATION_DATE_INVALID: "올바른 날짜를 선택해 주세요.",
    OPERATION_ID_INVALID: "삭제할 업무 정보가 올바르지 않습니다.",
    TAX_DATE_INVALID: "올바른 날짜를 선택해 주세요.",
    TAX_DIRECTION_INVALID: "입금 또는 출금을 선택해 주세요.",
    TAX_CATEGORY_REQUIRED: "거래 구분을 선택해 주세요.",
    TAX_AMOUNT_INVALID: "금액을 정확히 입력해 주세요.",
    TAX_TASK_TITLE_REQUIRED: "업무 제목을 입력해 주세요.",
    TAX_MONTH_INVALID: "예상 세금을 저장할 조회 월을 확인해 주세요.",
    TAX_FORECAST_CONFLICT: "다른 화면에서 같은 달의 예상 세금이 먼저 수정되었습니다. 최신 금액을 다시 확인해 주세요.",
    TAX_RECORD_ID_INVALID: "삭제할 기록을 확인해 주세요.",
    REQUEST_BODY_TOO_LARGE: "입력한 내용이 너무 깁니다."
  };
  return messages[error?.message] || "업무 정보를 처리하지 못했습니다.";
}

function requestType(req, body = null) {
  return String(body?.type ?? req.query?.type ?? "").trim();
}

async function handleEstimatePdf(req, res) {
  const auth = await requireAdmin(req, res, "estimate");
  if (!auth) return;
  const id = String(req.query?.id ?? "").trim();

  try {
    if (req.method === "POST") {
      const contentType = String(req.headers?.["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      const body = await readBinaryBody(req);
      if (contentType !== "application/pdf" || !body.length || !isPdf(body)) throw new Error("ESTIMATE_PDF_INVALID");
      const result = await saveEstimatePdf(id, body, safeFileName(req.headers?.["x-file-name"]), auth.user.id);
      return sendJson(res, 200, { ok: true, entry: result.entry, file: result.documentFile });
    }

    if (req.method === "GET") {
      const result = await readEstimatePdf(id);
      if (!result) return sendJson(res, 404, { ok: false, message: "저장된 견적서 PDF를 찾을 수 없습니다." });
      const disposition = String(req.query?.download ?? "") === "1" ? "attachment" : "inline";
      const filename = encodeURIComponent(result.documentFile?.name || "견적서.pdf");
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/pdf");
      if (Number.isFinite(result.blob?.size)) res.setHeader("Content-Length", String(result.blob.size));
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${filename}`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      Readable.fromWeb(result.stream).pipe(res);
      return;
    }

    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  } catch (error) {
    console.error("ADMIN_ESTIMATE_PDF_FAILED", error?.message ?? error);
    return sendJson(res, 400, { ok: false, message: errorMessage(error) });
  }
}

export default async function handler(req, res) {
  if (String(req.query?.type ?? "").trim() === "estimate-pdf") {
    return handleEstimatePdf(req, res);
  }

  let body = null;
  if (["POST", "PATCH"].includes(req.method)) {
    try {
      body = await readJsonBody(req);
    } catch (error) {
      return sendJson(res, 400, { ok: false, message: errorMessage(error) });
    }
  }

  const type = requestType(req, body);
  const permission = TYPE_PERMISSION[type];
  if (!permission) return sendJson(res, 400, { ok: false, message: "업무 구분을 확인해 주세요." });
  const auth = await requireAdmin(req, res, permission);
  if (!auth) return;
  if (type === "tax-forecast" && auth.user.role !== "owner") {
    return sendJson(res, 403, { ok: false, message: "예상 세금은 총책임자만 확인하고 수정할 수 있습니다." });
  }

  try {
    if (req.method === "GET") {
      if (type === "estimate") {
        const entries = await listEstimates();
        return sendJson(res, 200, { ok: true, entries, summary: summarizeEstimates(entries) });
      }
      if (type === "production") {
        const entries = await listProduction();
        return sendJson(res, 200, { ok: true, entries, summary: summarizeProduction(entries) });
      }
      if (type === "inventory") {
        const [items, movements] = await Promise.all([listInventory(), listInventoryMovements()]);
        return sendJson(res, 200, { ok: true, items, movements: movements.slice(0, 200), summary: summarizeInventory(items, movements) });
      }
      if (type === "tax") {
        const [transactions, tasks] = await Promise.all([listTaxTransactions(), listTaxTasks()]);
        const month = String(req.query?.month ?? "").trim();
        const summary = summarizeTaxWorkspace(transactions, tasks, month);
        const forecast = auth.user.role === "owner"
          ? summarizeTaxForecast(await readTaxForecast(summary.month), summary.month)
          : null;
        return sendJson(res, 200, {
          ok: true,
          transactions,
          tasks,
          summary,
          forecast,
          canManageForecast: auth.user.role === "owner"
        });
      }
    }

    if (["POST", "PATCH"].includes(req.method)) {
      if (type === "estimate") return sendJson(res, 200, { ok: true, entry: await saveEstimate(body, auth.user.id) });
      if (type === "production") return sendJson(res, 200, { ok: true, entry: await saveProduction(body, auth.user.id) });
      if (type === "inventory") return sendJson(res, 200, { ok: true, item: await saveInventory(body, auth.user.id) });
      if (type === "inventory-movement") return sendJson(res, 200, { ok: true, ...(await moveInventory(body, auth.user.id)) });
      if (type === "tax-transaction") return sendJson(res, 200, { ok: true, entry: await saveTaxTransaction(body, auth.user.id) });
      if (type === "tax-task") return sendJson(res, 200, { ok: true, entry: await saveTaxTask(body, auth.user.id) });
      if (type === "tax-forecast") return sendJson(res, 200, { ok: true, entry: summarizeTaxForecast(await saveTaxForecast(body, auth.user.id), body.month) });
    }

    if (req.method === "DELETE") {
      const id = String(req.query?.id ?? "").trim();
      if (type === "estimate") await deleteEstimate(id);
      else if (type === "production") await deleteProduction(id);
      else if (type === "inventory") await deleteInventory(id);
      else if (type === "tax-transaction") await deleteTaxTransaction(id);
      else if (type === "tax-task") await deleteTaxTask(id);
      else return sendJson(res, 405, { ok: false, message: "이 업무는 삭제할 수 없습니다." });
      return sendJson(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  } catch (error) {
    console.error("ADMIN_OPERATIONS_FAILED", type, error?.message ?? error);
    return sendJson(res, error?.message === "TAX_FORECAST_CONFLICT" ? 409 : 400, { ok: false, message: errorMessage(error) });
  }
}
