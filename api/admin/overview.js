import {
  getSafeIntegrationUrl,
  hasAdminPermission,
  requireAdmin,
  sendJson
} from "../../lib/admin-auth.js";
import { listWorklogs, summarizeWorklogs } from "../../lib/worklog-store.js";

function integration(name, envName) {
  const url = getSafeIntegrationUrl(process.env[envName]);
  return {
    name,
    connected: Boolean(url),
    status: url ? "연결됨" : "연결 전",
    url: url || null
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const canEstimate = hasAdminPermission(auth.user, "estimate");
  const canTax = hasAdminPermission(auth.user, "tax");
  const canWorklog = hasAdminPermission(auth.user, "worklog");
  const estimate = canEstimate
    ? integration("견적 ERP", "ESTIMATE_ERP_URL")
    : { name: "견적 ERP", connected: false, status: "권한 없음", url: null };
  const tax = canTax
    ? integration("세무·회계 ERP", "TAX_ERP_URL")
    : { name: "세무·회계 ERP", connected: false, status: "권한 없음", url: null };
  let taskSummary = canWorklog
    ? { value: null, label: "업무일지를 확인하지 못했습니다." }
    : { value: null, label: "권한 없음" };

  try {
    if (!canWorklog) throw new Error("WORKLOG_PERMISSION_SKIPPED");
    const entries = await listWorklogs();
    const worklog = summarizeWorklogs(entries);
    taskSummary = {
      value: `${worklog.active}건`,
      label: worklog.today ? `오늘 ${worklog.today}건 · 현장 업무일지` : "현장 업무일지 저장소 연결됨"
    };
  } catch (error) {
    if (error?.message === "WORKLOG_PERMISSION_SKIPPED") {
      // The summary remains hidden for employees without worklog permission.
    } else {
    console.error("ADMIN_OVERVIEW_WORKLOG_FAILED", error?.message ?? error);
    }
  }

  return sendJson(res, 200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    user: auth.user,
    company: {
      name: "주식회사 에스앤",
      phone: "031-852-2918",
      fax: "031-852-2919"
    },
    summary: {
      inquiries: { value: null, label: "문의 저장소 연결 필요" },
      estimates: { value: null, label: canEstimate ? (estimate.connected ? "ERP에서 확인" : "견적 ERP 연결 필요") : "권한 없음" },
      taxSchedule: { value: null, label: canTax ? (tax.connected ? "ERP에서 확인" : "세무 ERP 연결 필요") : "권한 없음" },
      tasks: taskSummary
    },
    integrations: { estimate, tax },
    session: { expiresAt: new Date(auth.session.exp * 1000).toISOString() }
  });
}
