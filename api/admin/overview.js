import {
  getSafeIntegrationUrl,
  hasAdminPermission,
  requireAdmin,
  sendJson
} from "../../lib/admin-auth.js";

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
  const canProduction = hasAdminPermission(auth.user, "production");
  const canInventory = hasAdminPermission(auth.user, "inventory");
  const estimate = canEstimate
    ? integration("견적 ERP", "ESTIMATE_ERP_URL")
    : { name: "견적 ERP", connected: false, status: "권한 없음", url: null };
  const tax = canTax
    ? { name: "세무·회계 업무대장", connected: true, status: "사용 가능", url: "/admin/tax", internal: true }
    : { name: "세무·회계 업무대장", connected: false, status: "권한 없음", url: null, internal: true };
  // Do not read Blob-backed records from the landing dashboard. Each legacy list
  // function performs one list request plus one private Blob get per JSON record,
  // so a single dashboard refresh previously consumed hundreds of Blob requests.
  // Detailed, current values remain available from their permission-gated menus.
  const detailOnlySummary = (allowed) => ({
    value: null,
    label: allowed ? "상세 메뉴에서 확인" : "권한 없음"
  });
  const taskSummary = detailOnlySummary(canWorklog);
  const estimateSummary = detailOnlySummary(canEstimate);
  const productionSummary = detailOnlySummary(canProduction);
  const inventorySummary = detailOnlySummary(canInventory);

  return sendJson(res, 200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    summaryMode: "detail-only",
    user: auth.user,
    company: {
      name: "주식회사 에스앤",
      phone: "031-852-2918",
      fax: "031-852-2919"
    },
    summary: {
      tasks: taskSummary,
      production: productionSummary,
      inventory: inventorySummary,
      estimates: estimateSummary
    },
    recentEstimates: [],
    integrations: { estimate, tax },
    session: { expiresAt: new Date(auth.session.exp * 1000).toISOString() }
  });
}
