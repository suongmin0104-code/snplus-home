import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  ClipboardList,
  createIcons,
  DatabaseZap,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FolderLock,
  Inbox,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  PlugZap,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Workflow,
  X
} from "lucide";

const iconSet = {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  ClipboardList,
  DatabaseZap,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FolderLock,
  Inbox,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  PlugZap,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Workflow,
  X
};

const integrationMeta = {
  estimate: {
    title: "견적 ERP",
    copy: "견적, 거래처, 수주 데이터를 확인하려면 사용 중인 견적 ERP를 연결해야 합니다.",
    requirement: "서비스 이름, 접속 주소, API 제공 여부, 담당자 계정 정책"
  },
  tax: {
    title: "세무·회계 ERP",
    copy: "신고 일정과 회계자료를 확인하려면 사용 중인 세무·회계 ERP를 연결해야 합니다.",
    requirement: "서비스 이름, 접속 주소, API 제공 여부, 세무대리인 연동 방식"
  }
};

const previewOverview = {
  ok: true,
  generatedAt: new Date().toISOString(),
  user: { name: "미리보기" },
  company: { name: "주식회사 에스앤", phone: "031-852-2918", fax: "031-852-2919" },
  summary: {
    inquiries: { value: null, label: "문의 저장소 연결 필요" },
    estimates: { value: null, label: "견적 ERP 연결 필요" },
    taxSchedule: { value: null, label: "세무 ERP 연결 필요" },
    tasks: { value: null, label: "업무 저장소 연결 필요" }
  },
  integrations: {
    estimate: { name: "견적 ERP", connected: false, status: "연결 전", url: null },
    tax: { name: "세무·회계 ERP", connected: false, status: "연결 전", url: null }
  },
  session: { expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() }
};

const state = {
  overview: previewOverview,
  currentModule: "dashboard",
  toastTimer: null
};

const body = document.body;
const loginForm = document.querySelector("[data-login-form]");
const loginMessage = document.querySelector("[data-login-message]");
const passwordToggle = document.querySelector("[data-password-toggle]");
const sidebar = document.querySelector("[data-sidebar]");
const dialog = document.querySelector("[data-integration-dialog]");
const toast = document.querySelector("[data-toast]");

createIcons({
  icons: iconSet,
  attrs: {
    "aria-hidden": "true",
    "stroke-width": 2
  }
});

function setAuthState(value) {
  body.dataset.authState = value;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {})
    }
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("ADMIN_API_UNAVAILABLE");
  }

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message || "요청을 처리하지 못했습니다.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...options
  }).format(date);
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function setPill(element, integration) {
  element.textContent = integration.connected ? "연결됨" : "연결 전";
  element.classList.toggle("is-connected", integration.connected);
  element.classList.toggle("is-pending", !integration.connected);
}

function applyOverview(overview) {
  state.overview = overview;
  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = overview.user?.name || "관리자";
  });

  const today = new Date();
  document.querySelectorAll("[data-today-label]").forEach((element) => {
    element.textContent = `${formatDate(today, { year: "numeric", month: "long", day: "numeric", weekday: "long" })} 업무 현황`;
  });

  for (const [key, summary] of Object.entries(overview.summary ?? {})) {
    document.querySelectorAll(`[data-summary="${key}"]`).forEach((element) => {
      element.textContent = summary.value ?? "연동 후 표시";
    });
    document.querySelectorAll(`[data-summary-note="${key}"]`).forEach((element) => {
      element.textContent = summary.label;
    });
  }

  for (const [key, integration] of Object.entries(overview.integrations ?? {})) {
    document.querySelectorAll(`[data-integration-pill="${key}"]`).forEach((element) => setPill(element, integration));
    document.querySelectorAll(`[data-nav-status="${key}"]`).forEach((element) => {
      element.textContent = integration.connected ? "연결됨" : "연결 전";
      element.classList.toggle("is-connected", integration.connected);
    });
    document.querySelectorAll(`[data-integration-title="${key}"]`).forEach((element) => {
      element.textContent = integration.status;
    });
    document.querySelectorAll(`[data-integration-copy="${key}"]`).forEach((element) => {
      element.textContent = integration.connected
        ? "연결 주소가 등록되었습니다. 외부 ERP는 새 창에서 열립니다."
        : integrationMeta[key].copy;
    });
    document.querySelectorAll(`[data-integration-action="${key}"]`).forEach((element) => {
      element.textContent = integration.connected ? "ERP 열기" : "ERP 연결 준비";
    });
  }

  const expiry = overview.session?.expiresAt ? new Date(overview.session.expiresAt) : null;
  document.querySelectorAll("[data-session-expiry]").forEach((element) => {
    element.textContent = expiry && !Number.isNaN(expiry.getTime())
      ? `현재 세션 만료: ${formatDate(expiry, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}`
      : "세션 만료 시간을 확인할 수 없습니다.";
  });
}

function showModule(moduleName) {
  const requested = document.querySelector(`[data-module-view="${moduleName}"]`) ? moduleName : "dashboard";
  state.currentModule = requested;
  document.querySelectorAll("[data-module-view]").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.moduleView === requested);
  });
  document.querySelectorAll("[data-module]").forEach((button) => {
    const active = button.dataset.module === requested;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  sidebar?.classList.remove("is-open");
  document.querySelector("#admin-main")?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openIntegrationDialog(key) {
  const meta = integrationMeta[key];
  const integration = state.overview.integrations?.[key];
  if (!meta || !integration || !dialog) return;

  dialog.querySelector("[data-dialog-title]").textContent = meta.title;
  dialog.querySelector("[data-dialog-copy]").textContent = integration.connected
    ? "등록된 ERP로 이동할 수 있습니다. 로그인 정보는 해당 ERP에서 직접 입력합니다."
    : meta.copy;
  dialog.querySelector("[data-dialog-requirement]").textContent = meta.requirement;
  dialog.querySelector("[data-dialog-status]").textContent = integration.status;

  const openLink = dialog.querySelector("[data-dialog-open]");
  if (integration.connected && integration.url) {
    openLink.href = integration.url;
    openLink.hidden = false;
  } else {
    openLink.removeAttribute("href");
    openLink.hidden = true;
  }

  dialog.showModal();
}

async function loadOverview({ notify = false } = {}) {
  const overview = await fetchJson("/api/admin/overview");
  applyOverview(overview);
  if (notify) showToast("업무 현황을 새로 확인했습니다.");
}

async function initialize() {
  const isLocalPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("ui-preview");
  if (isLocalPreview) {
    applyOverview(previewOverview);
    setAuthState("authenticated");
    return;
  }

  try {
    const session = await fetchJson("/api/admin/session");
    if (!session.configured) {
      setAuthState("setup");
      return;
    }
    if (!session.authenticated) {
      setAuthState("login");
      return;
    }
    await loadOverview();
    setAuthState("authenticated");
  } catch (error) {
    if (error.status === 503 && error.payload?.configured === false) {
      setAuthState("setup");
      return;
    }
    setAuthState("login");
    if (loginMessage) {
      loginMessage.textContent = error.message === "ADMIN_API_UNAVAILABLE"
        ? "관리자 API를 확인할 수 없습니다. 배포 환경에서 다시 접속해 주세요."
        : "관리자 세션을 확인하지 못했습니다. 다시 로그인해 주세요.";
    }
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  const submitButton = loginForm.querySelector("button[type='submit']");
  const formData = new FormData(loginForm);
  const payload = {
    username: String(formData.get("username") ?? "").trim(),
    password: String(formData.get("password") ?? "")
  };

  if (!payload.username || payload.password.length < 10) {
    loginMessage.textContent = "아이디와 비밀번호를 확인해 주세요.";
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "확인 중";
  try {
    await fetchJson("/api/admin/login", { method: "POST", body: JSON.stringify(payload) });
    loginForm.reset();
    await loadOverview();
    setAuthState("authenticated");
  } catch (error) {
    if (error.status === 503 && error.payload?.configured === false) {
      setAuthState("setup");
    } else {
      loginMessage.textContent = error.message || "로그인하지 못했습니다.";
    }
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "로그인";
  }
});

passwordToggle?.addEventListener("click", () => {
  const input = loginForm?.querySelector("input[name='password']");
  if (!input) return;
  const reveal = input.type === "password";
  input.type = reveal ? "text" : "password";
  passwordToggle.setAttribute("aria-label", reveal ? "비밀번호 숨기기" : "비밀번호 보기");
  passwordToggle.classList.toggle("is-visible", reveal);
});

document.querySelectorAll("[data-module]").forEach((button) => {
  button.addEventListener("click", () => showModule(button.dataset.module));
});

document.querySelectorAll("[data-go-module]").forEach((button) => {
  button.addEventListener("click", () => showModule(button.dataset.goModule));
});

document.querySelectorAll("[data-open-settings]").forEach((button) => {
  button.addEventListener("click", () => showModule("settings"));
});

document.querySelectorAll("[data-integration]").forEach((button) => {
  button.addEventListener("click", () => openIntegrationDialog(button.dataset.integration));
});

document.querySelectorAll("[data-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => dialog?.close());
});

dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

document.querySelector("[data-menu-toggle]")?.addEventListener("click", () => {
  sidebar?.classList.toggle("is-open");
});

document.querySelector("[data-refresh]")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.classList.add("is-spinning");
  try {
    await loadOverview({ notify: true });
  } catch (error) {
    if (error.status === 401) {
      setAuthState("login");
      showToast("보안 세션이 만료되었습니다.");
    } else {
      showToast("업무 현황을 새로 확인하지 못했습니다.");
    }
  } finally {
    button.classList.remove("is-spinning");
  }
});

document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  try {
    await fetchJson("/api/admin/logout", { method: "POST" });
  } catch {
    // The local state is cleared even if the network request fails.
  }
  state.overview = previewOverview;
  setAuthState("login");
  showModule("dashboard");
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && dialog?.open) dialog.close();
});

initialize();
