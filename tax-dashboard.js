import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeInfo,
  CalendarCheck2,
  CalendarPlus,
  Check,
  CircleDollarSign,
  CircleHelp,
  createIcons,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogOut,
  Menu,
  PanelLeft,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X
} from "lucide";

const iconSet = {
  ArrowLeft,
  ArrowLeftRight,
  BadgeInfo,
  CalendarCheck2,
  CalendarPlus,
  Check,
  CircleDollarSign,
  CircleHelp,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogOut,
  Menu,
  PanelLeft,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X
};

const body = document.body;
const app = document.querySelector("[data-tax-app]");
const loading = document.querySelector("[data-tax-loading]");
const accessPanel = document.querySelector("[data-tax-access]");
const accessMessage = document.querySelector("[data-tax-access-message]");
const sidebar = document.querySelector("[data-tax-sidebar]");
const scrim = document.querySelector("[data-tax-scrim]");
const toast = document.querySelector("[data-tax-toast]");
const monthInput = document.querySelector("[data-tax-month]");
const directionFilter = document.querySelector("[data-ledger-direction]");
const transactionDialog = document.querySelector("[data-transaction-dialog]");
const transactionForm = document.querySelector("[data-transaction-form]");
const taskDialog = document.querySelector("[data-task-dialog]");
const taskForm = document.querySelector("[data-task-form]");
const forecastDialog = document.querySelector("[data-forecast-dialog]");
const forecastForm = document.querySelector("[data-forecast-form]");

const params = new URLSearchParams(window.location.search);
const isPreview = import.meta.env.DEV && params.has("ui-preview");
const today = localDateKey();

const state = {
  user: null,
  month: today.slice(0, 7),
  transactions: [],
  tasks: [],
  forecast: null,
  loading: false,
  loadRequest: 0,
  checkingAccess: false,
  accessNeedsRefresh: false,
  toastTimer: null
};

const previewData = {
  transactions: [
    { id: "preview-tax-transaction-income", date: today, direction: "income", category: "매출", clientName: "거래처 예시", amount: 8800000, evidenceStatus: "attached", memo: "견적 납품대금 입금", updatedAt: new Date().toISOString() },
    { id: "preview-tax-transaction-expense", date: today, direction: "expense", category: "자재비", clientName: "자재 거래처 예시", amount: 2350000, evidenceStatus: "missing", memo: "세금계산서 확인 필요", updatedAt: new Date().toISOString() }
  ],
  tasks: [
    { id: "preview-tax-task-a", title: "부가가치세 자료 세무사 전달", dueDate: today, taskType: "부가가치세", ownerName: "담당자", memo: "매입 증빙 확인 후 전달", done: false, updatedAt: new Date().toISOString() },
    { id: "preview-tax-task-b", title: "급여대장 검토", dueDate: today, taskType: "급여·4대보험", ownerName: "담당자", memo: "", done: true, updatedAt: new Date().toISOString() }
  ],
  forecast: {
    month: today.slice(0, 7),
    saved: true,
    vatAmount: 720000,
    withholdingAmount: 180000,
    corporateTaxAmount: 1200000,
    otherTaxAmount: 0,
    totalAmount: 2100000,
    reviewStatus: "estimate",
    memo: "대표 화면 예시",
    updatedAt: new Date().toISOString()
  }
};

function refreshIcons() {
  createIcons({ icons: iconSet, attrs: { "aria-hidden": "true", "stroke-width": 2 } });
}

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value, options = {}) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", ...options }).format(date);
}

function formatCurrency(value) {
  const amount = Number(value) || 0;
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(amount)}원`;
}

function formatMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ""))) return "조회 월";
  const [year, month] = value.split("-").map(Number);
  return `${year}년 ${month}월`;
}

function formatUpdatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("세무·회계 서버 응답을 확인하지 못했습니다.");
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message || "요청을 처리하지 못했습니다.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function canUseTax(user) {
  return user?.role === "owner" || (Array.isArray(user?.permissions) && user.permissions.includes("tax"));
}

function setPageState(pageState, message = "") {
  body.dataset.taxState = pageState;
  loading.hidden = pageState !== "loading";
  app.hidden = pageState !== "ready";
  accessPanel.hidden = pageState !== "access";
  if (message && accessMessage) accessMessage.textContent = message;
}

function closeSidebar() {
  sidebar?.classList.remove("is-open");
  scrim?.classList.remove("is-visible");
}

function setBusy(button, busy, label = "저장") {
  if (!button) return;
  button.disabled = busy;
  const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = busy ? " 처리 중" : ` ${label}`;
}

function summarize() {
  const monthEntries = state.transactions.filter((entry) => String(entry.date || "").startsWith(state.month));
  const income = monthEntries.filter((entry) => entry.direction === "income").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const expense = monthEntries.filter((entry) => entry.direction === "expense").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const pendingTasks = state.tasks.filter((entry) => !entry.done);
  return {
    income,
    expense,
    balance: income - expense,
    transactionCount: monthEntries.length,
    missingEvidence: state.transactions.filter((entry) => entry.evidenceStatus === "missing").length,
    pendingTasks: pendingTasks.length,
    overdueTasks: pendingTasks.filter((entry) => entry.dueDate < today).length
  };
}

function evidenceLabel(status) {
  return {
    attached: "첨부 확인",
    missing: "확인 필요",
    "not-required": "증빙 없음"
  }[status] || "확인 필요";
}

function emptyMarkup(title, copy, icon = "list-checks") {
  return `<div class="empty-state"><i data-lucide="${icon}"></i><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div>`;
}

function renderSummary() {
  const summary = summarize();
  document.querySelector("[data-summary-income]").textContent = formatCurrency(summary.income);
  document.querySelector("[data-summary-expense]").textContent = formatCurrency(summary.expense);
  const balance = document.querySelector("[data-summary-balance]");
  balance.textContent = formatCurrency(summary.balance);
  balance.classList.toggle("is-negative", summary.balance < 0);
  document.querySelector("[data-summary-pending]").textContent = `${summary.pendingTasks}건`;
  document.querySelector("[data-summary-transaction-count]").textContent = `기록 ${summary.transactionCount}건`;
  document.querySelector("[data-summary-warning]").textContent = `지연 ${summary.overdueTasks}건 · 증빙 누락 ${summary.missingEvidence}건`;
  document.querySelector("[data-evidence-count]").textContent = String(summary.missingEvidence);
  document.querySelector("[data-nav-missing]").textContent = String(summary.missingEvidence);
}

function renderForecast() {
  const forecast = state.user?.role === "owner" ? (state.forecast || {}) : {};
  const total = ["vatAmount", "withholdingAmount", "corporateTaxAmount", "otherTaxAmount"]
    .reduce((sum, key) => sum + Number(forecast[key] || 0), 0);
  const saved = Boolean(forecast.saved || forecast.updatedAt);
  const reviewed = forecast.reviewStatus === "advisor-reviewed";
  const status = document.querySelector("[data-forecast-status]");

  document.querySelector("[data-forecast-month-label]").textContent = formatMonth(state.month);
  document.querySelector("[data-forecast-total]").textContent = formatCurrency(total);
  document.querySelector("[data-forecast-vat]").textContent = formatCurrency(forecast.vatAmount);
  document.querySelector("[data-forecast-withholding]").textContent = formatCurrency(forecast.withholdingAmount);
  document.querySelector("[data-forecast-corporate]").textContent = formatCurrency(forecast.corporateTaxAmount);
  document.querySelector("[data-forecast-other]").textContent = formatCurrency(forecast.otherTaxAmount);
  status.textContent = saved ? (reviewed ? "세무사 확인" : "세무사 확인 전") : "입력 전";
  status.classList.toggle("is-reviewed", saved && reviewed);
  status.classList.toggle("is-empty", !saved);
  document.querySelector("[data-forecast-updated]").textContent = saved
    ? `${reviewed ? "확인 금액" : "예상 금액"}${forecast.updatedAt ? ` · ${formatUpdatedAt(forecast.updatedAt)} 저장` : ""}`
    : "아직 입력된 예상 금액이 없습니다.";
}

function renderLedger() {
  const filter = directionFilter?.value || "all";
  const entries = state.transactions.filter((entry) => {
    return String(entry.date || "").startsWith(state.month) && (filter === "all" || entry.direction === filter);
  });
  const list = document.querySelector("[data-ledger-list]");
  if (!entries.length) {
    list.innerHTML = emptyMarkup("이 달의 입출금 기록이 없습니다.", "새 기록을 눌러 첫 거래를 입력해 주세요.", "arrow-left-right");
    refreshIcons();
    return;
  }
  list.innerHTML = entries.map((entry) => {
    const direction = entry.direction === "income" ? "입금" : "출금";
    const sign = entry.direction === "income" ? "+" : "-";
    const content = entry.clientName || entry.memo || entry.category;
    return `<article class="ledger-entry" data-transaction-id="${escapeHtml(entry.id)}">
      <time datetime="${escapeHtml(entry.date)}">${escapeHtml(formatDate(entry.date))}</time>
      <span class="direction-badge ${escapeHtml(entry.direction)}">${direction}</span>
      <div class="ledger-content"><strong>${escapeHtml(content)}</strong><small>${escapeHtml(entry.category)}${entry.memo && entry.memo !== content ? ` · ${escapeHtml(entry.memo)}` : ""}</small></div>
      <strong class="ledger-amount ${escapeHtml(entry.direction)}">${sign}${escapeHtml(formatCurrency(entry.amount))}</strong>
      <span class="evidence-badge ${escapeHtml(entry.evidenceStatus)}">${escapeHtml(evidenceLabel(entry.evidenceStatus))}</span>
      <button class="row-action" type="button" data-edit-transaction="${escapeHtml(entry.id)}" aria-label="입출금 기록 수정" title="수정"><i data-lucide="pencil"></i></button>
    </article>`;
  }).join("");
  refreshIcons();
}

function dueLabel(entry) {
  if (entry.done) return `${formatDate(entry.dueDate)} · 완료`;
  const target = new Date(`${entry.dueDate}T00:00:00`);
  const current = new Date(`${today}T00:00:00`);
  const days = Math.round((target - current) / 86400000);
  if (days < 0) return `${formatDate(entry.dueDate)} · ${Math.abs(days)}일 지연`;
  if (days === 0) return `${formatDate(entry.dueDate)} · 오늘 마감`;
  return `${formatDate(entry.dueDate)} · D-${days}`;
}

function renderTasks() {
  const selected = state.tasks
    .filter((entry) => String(entry.dueDate || "").startsWith(state.month) || (!entry.done && entry.dueDate < `${state.month}-01`))
    .slice(0, 20);
  const list = document.querySelector("[data-tax-task-list]");
  if (!selected.length) {
    list.innerHTML = emptyMarkup("등록된 세무 일정이 없습니다.", "일정 추가로 마감할 업무를 기록해 주세요.", "calendar-check-2");
    refreshIcons();
    return;
  }
  list.innerHTML = selected.map((entry) => {
    const overdue = !entry.done && entry.dueDate < today;
    return `<article class="task-entry${entry.done ? " is-done" : ""}${overdue ? " is-overdue" : ""}" data-task-id="${escapeHtml(entry.id)}">
      <button class="task-toggle" type="button" data-toggle-task="${escapeHtml(entry.id)}" aria-label="${entry.done ? "완료 취소" : "완료 처리"}"><i data-lucide="check"></i></button>
      <div class="task-copy"><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(dueLabel(entry))}</span><small>${escapeHtml([entry.taskType, entry.ownerName].filter(Boolean).join(" · ") || "담당자 미지정")}</small></div>
      <button class="row-action" type="button" data-edit-task="${escapeHtml(entry.id)}" aria-label="세무 일정 수정" title="수정"><i data-lucide="pencil"></i></button>
    </article>`;
  }).join("");
  refreshIcons();
}

function renderEvidence() {
  const entries = state.transactions.filter((entry) => entry.evidenceStatus === "missing").slice(0, 12);
  const list = document.querySelector("[data-evidence-list]");
  if (!entries.length) {
    list.innerHTML = emptyMarkup("확인할 증빙이 없습니다.", "모든 거래의 증빙 상태가 정리되었습니다.", "shield-check");
    refreshIcons();
    return;
  }
  list.innerHTML = entries.map((entry) => `<article class="evidence-entry">
    <span><i data-lucide="paperclip"></i></span>
    <div><strong>${escapeHtml(entry.clientName || entry.category)}</strong><small>${escapeHtml(entry.date)} · ${escapeHtml(formatCurrency(entry.amount))} · ${escapeHtml(entry.category)}</small></div>
    <button type="button" data-fix-evidence="${escapeHtml(entry.id)}">상태 수정</button>
  </article>`).join("");
  refreshIcons();
}

function render() {
  renderSummary();
  renderForecast();
  renderLedger();
  renderTasks();
  renderEvidence();
}

async function loadWorkspace({ notify = false } = {}) {
  const requestedMonth = state.month;
  const requestId = ++state.loadRequest;
  state.loading = true;
  document.querySelector("[data-tax-refresh]")?.classList.add("is-spinning");
  try {
    let nextTransactions;
    let nextTasks;
    let nextForecast;
    if (isPreview) {
      nextTransactions = [...previewData.transactions];
      nextTasks = [...previewData.tasks];
      nextForecast = { ...previewData.forecast, month: requestedMonth };
    } else {
      const payload = await fetchJson(`/api/admin/operations?type=tax&month=${encodeURIComponent(requestedMonth)}`);
      nextTransactions = Array.isArray(payload.transactions) ? payload.transactions : [];
      nextTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
      nextForecast = state.user?.role === "owner" && payload.forecast ? payload.forecast : null;
    }
    if (requestId !== state.loadRequest || requestedMonth !== state.month) return;
    state.transactions = nextTransactions;
    state.tasks = nextTasks;
    state.forecast = nextForecast;
    render();
    if (notify) showToast("세무·회계 업무를 새로 확인했습니다.");
  } catch (error) {
    if (requestId !== state.loadRequest || requestedMonth !== state.month) return;
    handleError(error, "세무·회계 업무를 불러오지 못했습니다.");
  } finally {
    if (requestId === state.loadRequest) {
      state.loading = false;
      document.querySelector("[data-tax-refresh]")?.classList.remove("is-spinning");
    }
  }
}

function handleError(error, fallback) {
  if (error?.status === 401) {
    window.location.replace("/admin");
    return;
  }
  if (error?.status === 403) {
    setPageState("access", "이 계정에는 세무·회계 권한이 없습니다. 총책임자에게 권한을 요청해 주세요.");
    return;
  }
  showToast(error?.message || fallback);
}

function openTransaction(entry = null) {
  transactionForm.reset();
  transactionForm.elements.id.value = entry?.id || "";
  transactionForm.elements.date.value = entry?.date || today;
  transactionForm.elements.direction.value = entry?.direction || "expense";
  transactionForm.elements.category.value = entry?.category || "자재비";
  transactionForm.elements.amount.value = entry?.amount || "";
  transactionForm.elements.clientName.value = entry?.clientName || "";
  transactionForm.elements.evidenceStatus.value = entry?.evidenceStatus || "missing";
  transactionForm.elements.memo.value = entry?.memo || "";
  document.querySelector("[data-transaction-dialog-title]").textContent = entry ? "입출금 기록 수정" : "입출금 기록";
  document.querySelector("[data-delete-transaction]").hidden = !entry;
  transactionDialog.showModal();
  window.setTimeout(() => transactionForm.elements.date.focus(), 80);
}

function openTask(entry = null) {
  taskForm.reset();
  taskForm.elements.id.value = entry?.id || "";
  taskForm.elements.title.value = entry?.title || "";
  taskForm.elements.dueDate.value = entry?.dueDate || today;
  taskForm.elements.taskType.value = entry?.taskType || "자료 제출";
  taskForm.elements.ownerName.value = entry?.ownerName || state.user?.name || "";
  taskForm.elements.done.checked = Boolean(entry?.done);
  taskForm.elements.memo.value = entry?.memo || "";
  document.querySelector("[data-task-dialog-title]").textContent = entry ? "세무 일정 수정" : "세무 일정 등록";
  document.querySelector("[data-delete-task]").hidden = !entry;
  taskDialog.showModal();
  window.setTimeout(() => taskForm.elements.title.focus(), 80);
}

function openForecast() {
  if (state.user?.role !== "owner") return;
  const forecast = state.forecast || {};
  forecastForm.reset();
  forecastForm.querySelector("[data-forecast-month-display]").value = state.month;
  forecastForm.elements.vatAmount.value = forecast.vatAmount || "";
  forecastForm.elements.withholdingAmount.value = forecast.withholdingAmount || "";
  forecastForm.elements.corporateTaxAmount.value = forecast.corporateTaxAmount || "";
  forecastForm.elements.otherTaxAmount.value = forecast.otherTaxAmount || "";
  forecastForm.elements.reviewStatus.value = forecast.reviewStatus || "estimate";
  forecastForm.elements.memo.value = forecast.memo || "";
  forecastDialog.showModal();
  window.setTimeout(() => forecastForm.elements.vatAmount.focus(), 80);
}

function upsertPreview(collection, entry) {
  const index = collection.findIndex((item) => item.id === entry.id);
  if (index >= 0) collection[index] = entry;
  else collection.unshift(entry);
}

async function saveRecord(type, payload) {
  if (isPreview) {
    const entry = { ...payload, id: payload.id || globalThis.crypto?.randomUUID?.() || `preview-${Date.now()}`, updatedAt: new Date().toISOString() };
    if (type === "transaction") upsertPreview(state.transactions, entry);
    else if (type === "task") upsertPreview(state.tasks, entry);
    else state.forecast = { ...entry, saved: true };
    render();
    return entry;
  }
  const result = await fetchJson("/api/admin/operations", { method: "POST", body: JSON.stringify({ type: `tax-${type}`, ...payload }) });
  await loadWorkspace();
  return result.entry;
}

async function deleteRecord(type, id) {
  if (isPreview) {
    if (type === "transaction") state.transactions = state.transactions.filter((entry) => entry.id !== id);
    else state.tasks = state.tasks.filter((entry) => entry.id !== id);
    render();
    return;
  }
  await fetchJson(`/api/admin/operations?type=${encodeURIComponent(`tax-${type}`)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
  await loadWorkspace();
}

transactionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = transactionForm.querySelector("button[type='submit']");
  const formData = new FormData(transactionForm);
  const payload = {
    id: String(formData.get("id") || ""),
    date: String(formData.get("date") || ""),
    direction: String(formData.get("direction") || ""),
    category: String(formData.get("category") || ""),
    amount: Number(formData.get("amount") || 0),
    clientName: String(formData.get("clientName") || "").trim(),
    evidenceStatus: String(formData.get("evidenceStatus") || "missing"),
    memo: String(formData.get("memo") || "").trim()
  };
  setBusy(submit, true);
  try {
    await saveRecord("transaction", payload);
    transactionDialog.close();
    showToast("입출금 기록을 저장했습니다.");
  } catch (error) {
    handleError(error, "입출금 기록을 저장하지 못했습니다.");
  } finally {
    setBusy(submit, false);
  }
});

taskForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = taskForm.querySelector("button[type='submit']");
  const formData = new FormData(taskForm);
  const payload = {
    id: String(formData.get("id") || ""),
    title: String(formData.get("title") || "").trim(),
    dueDate: String(formData.get("dueDate") || ""),
    taskType: String(formData.get("taskType") || "기타"),
    ownerName: String(formData.get("ownerName") || "").trim(),
    done: formData.get("done") === "on",
    memo: String(formData.get("memo") || "").trim()
  };
  setBusy(submit, true);
  try {
    await saveRecord("task", payload);
    taskDialog.close();
    showToast("세무 일정을 저장했습니다.");
  } catch (error) {
    handleError(error, "세무 일정을 저장하지 못했습니다.");
  } finally {
    setBusy(submit, false);
  }
});

forecastForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.user?.role !== "owner") return;
  const submit = forecastForm.querySelector("button[type='submit']");
  const formData = new FormData(forecastForm);
  const payload = {
    month: state.month,
    expectedVersion: String(state.forecast?.version || ""),
    vatAmount: Number(formData.get("vatAmount") || 0),
    withholdingAmount: Number(formData.get("withholdingAmount") || 0),
    corporateTaxAmount: Number(formData.get("corporateTaxAmount") || 0),
    otherTaxAmount: Number(formData.get("otherTaxAmount") || 0),
    reviewStatus: String(formData.get("reviewStatus") || "estimate"),
    memo: String(formData.get("memo") || "").trim()
  };
  setBusy(submit, true);
  try {
    await saveRecord("forecast", payload);
    forecastDialog.close();
    showToast("대표 예상 세금을 저장했습니다.");
  } catch (error) {
    if (error?.status === 409) {
      forecastDialog.close();
      await loadWorkspace();
      showToast(error.message || "다른 화면에서 수정된 최신 금액을 불러왔습니다.");
    } else {
      handleError(error, "예상 세금을 저장하지 못했습니다.");
    }
  } finally {
    setBusy(submit, false);
  }
});

document.querySelectorAll("[data-open-transaction]").forEach((button) => button.addEventListener("click", () => openTransaction()));
document.querySelectorAll("[data-open-task]").forEach((button) => button.addEventListener("click", () => openTask()));
document.querySelectorAll("[data-open-forecast]").forEach((button) => button.addEventListener("click", openForecast));
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));

document.querySelector("[data-ledger-list]")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-transaction]");
  if (!button) return;
  openTransaction(state.transactions.find((entry) => entry.id === button.dataset.editTransaction) || null);
});

document.querySelector("[data-evidence-list]")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-fix-evidence]");
  if (!button) return;
  openTransaction(state.transactions.find((entry) => entry.id === button.dataset.fixEvidence) || null);
});

document.querySelector("[data-tax-task-list]")?.addEventListener("click", async (event) => {
  const toggle = event.target.closest("[data-toggle-task]");
  if (toggle) {
    const entry = state.tasks.find((item) => item.id === toggle.dataset.toggleTask);
    if (!entry) return;
    toggle.disabled = true;
    try {
      await saveRecord("task", { ...entry, done: !entry.done });
      showToast(entry.done ? "완료를 취소했습니다." : "업무를 완료했습니다.");
    } catch (error) {
      handleError(error, "업무 상태를 바꾸지 못했습니다.");
    } finally {
      toggle.disabled = false;
    }
    return;
  }
  const edit = event.target.closest("[data-edit-task]");
  if (edit) openTask(state.tasks.find((entry) => entry.id === edit.dataset.editTask) || null);
});

document.querySelector("[data-delete-transaction]")?.addEventListener("click", async () => {
  const id = transactionForm.elements.id.value;
  if (!id || !window.confirm("이 입출금 기록을 삭제할까요?")) return;
  try {
    await deleteRecord("transaction", id);
    transactionDialog.close();
    showToast("입출금 기록을 삭제했습니다.");
  } catch (error) {
    handleError(error, "입출금 기록을 삭제하지 못했습니다.");
  }
});

document.querySelector("[data-delete-task]")?.addEventListener("click", async () => {
  const id = taskForm.elements.id.value;
  if (!id || !window.confirm("이 세무 일정을 삭제할까요?")) return;
  try {
    await deleteRecord("task", id);
    taskDialog.close();
    showToast("세무 일정을 삭제했습니다.");
  } catch (error) {
    handleError(error, "세무 일정을 삭제하지 못했습니다.");
  }
});

monthInput?.addEventListener("change", async () => {
  if (!/^\d{4}-\d{2}$/.test(monthInput.value)) return;
  state.month = monthInput.value;
  await loadWorkspace();
});
directionFilter?.addEventListener("change", renderLedger);
document.querySelector("[data-tax-refresh]")?.addEventListener("click", () => loadWorkspace({ notify: true }));

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-scroll-target]").forEach((item) => item.classList.toggle("is-active", item === button));
    document.getElementById(button.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    closeSidebar();
  });
});

document.querySelector("[data-menu-toggle]")?.addEventListener("click", () => {
  sidebar?.classList.add("is-open");
  scrim?.classList.add("is-visible");
});
scrim?.addEventListener("click", closeSidebar);

[transactionDialog, taskDialog, forecastDialog].forEach((dialog) => dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
}));

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeSidebar();
});

function initializeServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
}

function applyUserAccess(user) {
  state.user = user;
  const isOwner = user?.role === "owner";
  document.querySelector("[data-user-name]").textContent = user?.name || "관리자";
  document.querySelector("[data-user-role]").textContent = isOwner ? "총책임자 · 모든 권한" : `${user?.title || "직원"} · 세무 권한`;
  document.querySelector("[data-user-initial]").textContent = String(user?.name || "SN").slice(0, 2);
  document.querySelectorAll("[data-owner-forecast]").forEach((element) => {
    element.hidden = !isOwner;
  });
  if (!isOwner) {
    state.forecast = null;
    if (forecastDialog?.open) forecastDialog.close();
  }
  renderForecast();
}

function concealOwnerForecast() {
  if (isPreview || state.user?.role !== "owner") return;
  state.forecast = null;
  state.accessNeedsRefresh = true;
  document.querySelectorAll("[data-owner-forecast]").forEach((element) => {
    element.hidden = true;
  });
  if (forecastDialog?.open) forecastDialog.close();
  renderForecast();
}

async function revalidateAccess() {
  if (isPreview || state.checkingAccess || document.hidden || !state.accessNeedsRefresh) return;
  state.checkingAccess = true;
  try {
    const session = await fetchJson("/api/admin/session");
    if (!session.authenticated) {
      concealOwnerForecast();
      window.location.replace("/admin");
      return;
    }
    if (!canUseTax(session.user)) {
      applyUserAccess(session.user);
      setPageState("access", "이 계정에는 세무·회계 권한이 없습니다. 총책임자에게 권한을 요청해 주세요.");
      return;
    }
    applyUserAccess(session.user);
    state.accessNeedsRefresh = false;
    setPageState("ready");
    await loadWorkspace();
  } catch (error) {
    handleError(error, "로그인 상태를 다시 확인하지 못했습니다.");
  } finally {
    state.checkingAccess = false;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (!isPreview) state.accessNeedsRefresh = true;
    concealOwnerForecast();
  } else {
    revalidateAccess();
  }
});
window.addEventListener("focus", revalidateAccess);

async function initialize() {
  refreshIcons();
  monthInput.value = state.month;
  document.querySelector("[data-today-label]").textContent = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long"
  }).format(new Date());

  if (isPreview) {
    state.user = { name: "총책임자", role: "owner", permissions: ["tax"] };
  } else {
    try {
      const session = await fetchJson("/api/admin/session");
      if (!session.authenticated) {
        window.location.replace("/admin");
        return;
      }
      state.user = session.user;
    } catch (error) {
      handleError(error, "로그인 상태를 확인하지 못했습니다.");
      return;
    }
  }

  if (!canUseTax(state.user)) {
    setPageState("access", "이 계정에는 세무·회계 권한이 없습니다. 총책임자에게 권한을 요청해 주세요.");
    return;
  }

  applyUserAccess(state.user);
  setPageState("ready");
  await loadWorkspace();
  initializeServiceWorker();
}

initialize();
