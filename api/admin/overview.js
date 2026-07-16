import {
  getSafeIntegrationUrl,
  hasAdminPermission,
  requireAdmin,
  sendJson
} from "../../lib/admin-auth.js";
import { listWorklogs, summarizeWorklogs } from "../../lib/worklog-store.js";
import {
  listEstimates,
  listInventory,
  listInventoryMovements,
  listProduction,
  summarizeEstimates,
  summarizeInventory,
  summarizeProduction
} from "../../lib/operations-store.js";

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
    ? integration("세무·회계 ERP", "TAX_ERP_URL")
    : { name: "세무·회계 ERP", connected: false, status: "권한 없음", url: null };
  let taskSummary = canWorklog
    ? { value: null, label: "업무일지를 확인하지 못했습니다." }
    : { value: null, label: "권한 없음" };
  let estimateSummary = canEstimate ? { value: null, label: "견적 일정을 확인하지 못했습니다." } : { value: null, label: "권한 없음" };
  let productionSummary = canProduction ? { value: null, label: "생산일보를 확인하지 못했습니다." } : { value: null, label: "권한 없음" };
  let inventorySummary = canInventory ? { value: null, label: "재고를 확인하지 못했습니다." } : { value: null, label: "권한 없음" };
  let recentEstimates = [];

  try {
    if (!canWorklog) throw new Error("WORKLOG_PERMISSION_SKIPPED");
    const entries = await listWorklogs();
    const worklog = summarizeWorklogs(entries);
    taskSummary = {
      value: `${worklog.total}건`,
      label: `오늘 ${worklog.today}건 · 이번 달 ${worklog.month}건`
    };
  } catch (error) {
    if (error?.message === "WORKLOG_PERMISSION_SKIPPED") {
      // The summary remains hidden for employees without worklog permission.
    } else {
      console.error("ADMIN_OVERVIEW_WORKLOG_FAILED", error?.message ?? error);
    }
  }

  try {
    if (canEstimate) {
      const entries = await listEstimates();
      const summary = summarizeEstimates(entries);
      estimateSummary = { value: `${summary.total}건`, label: `오늘 ${summary.today}건 · 이번 달 ${summary.month}건` };
      recentEstimates = [...entries].sort((left, right) => `${right.date}${right.updatedAt}`.localeCompare(`${left.date}${left.updatedAt}`)).slice(0, 5);
    }
  } catch (error) {
    console.error("ADMIN_OVERVIEW_ESTIMATE_FAILED", error?.message ?? error);
  }

  try {
    if (canProduction) {
      const entries = await listProduction();
      const summary = summarizeProduction(entries);
      productionSummary = { value: `${summary.waiting}건`, label: `오늘 ${summary.today}건 · 생산완료 ${summary.shipped}건` };
    }
  } catch (error) {
    console.error("ADMIN_OVERVIEW_PRODUCTION_FAILED", error?.message ?? error);
  }

  try {
    if (canInventory) {
      const [items, movements] = await Promise.all([listInventory(), listInventoryMovements()]);
      const summary = summarizeInventory(items, movements);
      inventorySummary = { value: `${summary.items}종`, label: `전체 수량 ${summary.totalQuantity.toLocaleString("ko-KR")}` };
    }
  } catch (error) {
    console.error("ADMIN_OVERVIEW_INVENTORY_FAILED", error?.message ?? error);
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
      tasks: taskSummary,
      production: productionSummary,
      inventory: inventorySummary,
      estimates: estimateSummary
    },
    recentEstimates,
    integrations: { estimate, tax },
    session: { expiresAt: new Date(auth.session.exp * 1000).toISOString() }
  });
}
