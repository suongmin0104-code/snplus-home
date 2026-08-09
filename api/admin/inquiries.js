import {
  CONTACT_STATUS_VALUES,
  listContactInquiries,
  readContactInquiry,
  summarizeContactInquiries,
  updateContactStatus
} from "../../lib/contact-store.js";
import { readJsonBody, requireAdmin, sendJson } from "../../lib/admin-auth.js";

function errorMessage(error) {
  if (error?.message === "CONTACT_LEAD_ID_INVALID") return "문의 접수번호가 올바르지 않습니다.";
  if (error?.message === "CONTACT_STATUS_INVALID") return "문의 처리상태가 올바르지 않습니다.";
  if (error?.message === "CONTACT_NOT_FOUND") return "문의 내용을 찾을 수 없습니다.";
  if (error?.message === "REQUEST_BODY_TOO_LARGE") return "요청 내용이 너무 큽니다.";
  return "홈페이지 문의함을 불러오지 못했습니다.";
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res, "estimate");
  if (!auth) return;

  try {
    if (req.method === "GET") {
      const leadId = String(req.query?.id ?? "").trim();
      if (leadId) {
        const entry = await readContactInquiry(leadId);
        if (!entry) return sendJson(res, 404, { ok: false, message: "문의 내용을 찾을 수 없습니다." });
        return sendJson(res, 200, { ok: true, entry, statuses: CONTACT_STATUS_VALUES });
      }

      const entries = await listContactInquiries(250);
      return sendJson(res, 200, {
        ok: true,
        entries,
        summary: summarizeContactInquiries(entries),
        statuses: CONTACT_STATUS_VALUES
      });
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const leadId = String(payload?.leadId ?? "").trim();
      const status = String(payload?.status ?? "").trim();
      const entry = await updateContactStatus(leadId, status, auth.user.id);
      return sendJson(res, 200, { ok: true, entry });
    }

    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  } catch (error) {
    console.error("ADMIN_CONTACT_INQUIRIES_FAILED", error?.message ?? error);
    const statusCode = error?.message === "CONTACT_NOT_FOUND" ? 404 : 400;
    return sendJson(res, statusCode, { ok: false, message: errorMessage(error) });
  }
}
