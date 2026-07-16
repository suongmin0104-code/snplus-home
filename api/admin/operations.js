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
  saveEstimate,
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
  saveTaxTask,
  saveTaxTransaction,
  summarizeTaxWorkspace
} from "../../lib/tax-store.js";

const TYPE_PERMISSION = Object.freeze({
  estimate: "estimate",
  production: "production",
  inventory: "inventory",
  "inventory-movement": "inventory",
  tax: "tax",
  "tax-transaction": "tax",
  "tax-task": "tax"
});

function errorMessage(error) {
  const messages = {
    ESTIMATE_TITLE_REQUIRED: "견적 제목을 입력해 주세요.",
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
    TAX_RECORD_ID_INVALID: "삭제할 기록을 확인해 주세요.",
    REQUEST_BODY_TOO_LARGE: "입력한 내용이 너무 깁니다."
  };
  return messages[error?.message] || "업무 정보를 처리하지 못했습니다.";
}

function requestType(req, body = null) {
  return String(body?.type ?? req.query?.type ?? "").trim();
}

export default async function handler(req, res) {
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
        return sendJson(res, 200, {
          ok: true,
          transactions,
          tasks,
          summary: summarizeTaxWorkspace(transactions, tasks, month)
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
    return sendJson(res, 400, { ok: false, message: errorMessage(error) });
  }
}
