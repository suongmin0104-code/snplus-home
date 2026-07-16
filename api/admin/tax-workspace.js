import { readJsonBody, requireAdmin, sendJson } from "../../lib/admin-auth.js";
import {
  deleteTaxTask,
  deleteTaxTransaction,
  listTaxTasks,
  listTaxTransactions,
  saveTaxTask,
  saveTaxTransaction,
  summarizeTaxWorkspace
} from "../../lib/tax-store.js";

const RECORD_TYPES = new Set(["transaction", "task"]);

function errorMessage(error) {
  const messages = {
    TAX_DATE_INVALID: "올바른 날짜를 선택해 주세요.",
    TAX_DIRECTION_INVALID: "입금 또는 출금을 선택해 주세요.",
    TAX_CATEGORY_REQUIRED: "거래 구분을 선택해 주세요.",
    TAX_AMOUNT_INVALID: "금액을 정확히 입력해 주세요.",
    TAX_TASK_TITLE_REQUIRED: "업무 제목을 입력해 주세요.",
    TAX_RECORD_ID_INVALID: "삭제할 기록을 확인해 주세요.",
    REQUEST_BODY_TOO_LARGE: "입력한 내용이 너무 깁니다."
  };
  return messages[error?.message] || "세무·회계 업무를 처리하지 못했습니다.";
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res, "tax");
  if (!auth) return;

  let body = null;
  if (["POST", "PATCH"].includes(req.method)) {
    try {
      body = await readJsonBody(req);
    } catch (error) {
      return sendJson(res, 400, { ok: false, message: errorMessage(error) });
    }
  }

  try {
    if (req.method === "GET") {
      const [transactions, tasks] = await Promise.all([listTaxTransactions(), listTaxTasks()]);
      const month = String(req.query?.month ?? "").trim();
      return sendJson(res, 200, {
        ok: true,
        transactions,
        tasks,
        summary: summarizeTaxWorkspace(transactions, tasks, month)
      });
    }

    if (["POST", "PATCH"].includes(req.method)) {
      if (body?.type === "transaction") {
        return sendJson(res, 200, { ok: true, entry: await saveTaxTransaction(body, auth.user.id) });
      }
      if (body?.type === "task") {
        return sendJson(res, 200, { ok: true, entry: await saveTaxTask(body, auth.user.id) });
      }
      return sendJson(res, 400, { ok: false, message: "업무 구분을 확인해 주세요." });
    }

    if (req.method === "DELETE") {
      const type = String(req.query?.type ?? "").trim();
      const id = String(req.query?.id ?? "").trim();
      if (!RECORD_TYPES.has(type)) return sendJson(res, 400, { ok: false, message: "업무 구분을 확인해 주세요." });
      if (type === "transaction") await deleteTaxTransaction(id);
      else await deleteTaxTask(id);
      return sendJson(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  } catch (error) {
    console.error("ADMIN_TAX_WORKSPACE_FAILED", error?.message ?? error);
    return sendJson(res, 400, { ok: false, message: errorMessage(error) });
  }
}
