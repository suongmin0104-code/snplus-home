import {
  getSafeIntegrationUrl,
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

  const auth = requireAdmin(req, res);
  if (!auth) return;

  const estimate = integration("견적 ERP", "ESTIMATE_ERP_URL");
  const tax = integration("세무·회계 ERP", "TAX_ERP_URL");
  let taskSummary = { value: null, label: "업무일지를 확인하지 못했습니다." };

  try {
    const entries = await listWorklogs();
    const worklog = summarizeWorklogs(entries);
    taskSummary = {
      value: `${worklog.active}건`,
      label: worklog.today ? `오늘 ${worklog.today}건 · 현장 업무일지` : "현장 업무일지 저장소 연결됨"
    };
  } catch (error) {
    console.error("ADMIN_OVERVIEW_WORKLOG_FAILED", error?.message ?? error);
  }

  return sendJson(res, 200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    user: { name: auth.session.sub },
    company: {
      name: "주식회사 에스앤",
      phone: "031-852-2918",
      fax: "031-852-2919"
    },
    summary: {
      inquiries: { value: null, label: "문의 저장소 연결 필요" },
      estimates: { value: null, label: estimate.connected ? "ERP에서 확인" : "견적 ERP 연결 필요" },
      taxSchedule: { value: null, label: tax.connected ? "ERP에서 확인" : "세무 ERP 연결 필요" },
      tasks: taskSummary
    },
    integrations: { estimate, tax },
    session: { expiresAt: new Date(auth.session.exp * 1000).toISOString() }
  });
}
