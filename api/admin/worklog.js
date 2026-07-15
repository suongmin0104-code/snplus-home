import { deleteWorklog, listWorklogs, saveWorklog, summarizeWorklogs } from "../../lib/worklog-store.js";
import { readJsonBody, requireAdmin, sendJson } from "../../lib/admin-auth.js";

function errorMessage(error) {
  if (error?.message === "WORKLOG_TITLE_REQUIRED") return "일정 제목을 입력해 주세요.";
  if (error?.message === "WORKLOG_DATE_INVALID") return "올바른 날짜를 선택해 주세요.";
  if (error?.message === "WORKLOG_ID_INVALID") return "삭제할 업무일지 정보가 올바르지 않습니다.";
  if (error?.message === "REQUEST_BODY_TOO_LARGE") return "업무일지 내용이 너무 깁니다.";
  return "업무일지를 처리하지 못했습니다.";
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res, "worklog");
  if (!auth) return;

  try {
    if (req.method === "GET") {
      const entries = await listWorklogs();
      return sendJson(res, 200, { ok: true, entries, summary: summarizeWorklogs(entries) });
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const entry = await saveWorklog(payload, auth.user.id);
      return sendJson(res, 200, { ok: true, entry });
    }

    if (req.method === "DELETE") {
      const id = String(req.query?.id ?? "").trim();
      await deleteWorklog(id);
      return sendJson(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  } catch (error) {
    console.error("ADMIN_WORKLOG_FAILED", error?.message ?? error);
    return sendJson(res, 400, { ok: false, message: errorMessage(error) });
  }
}
