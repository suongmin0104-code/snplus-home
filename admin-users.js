const statusMeta = {
  active: { label: "사용 중", className: "is-active" },
  pending: { label: "등록 대기", className: "is-pending" },
  disabled: { label: "사용 중지", className: "is-disabled" }
};

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "접속 기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function initials(name) {
  return String(name || "직원").trim().slice(0, 2);
}

function makeAction(label, action, icon) {
  const button = element("button", "employee-action");
  button.type = "button";
  button.dataset.userAction = action;
  button.innerHTML = `<i data-lucide="${icon}"></i><span>${label}</span>`;
  return button;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function setupUserManagement({ fetchJson, showToast, refreshIcons, onUnauthorized }) {
  const list = document.querySelector("[data-user-list]");
  const dialog = document.querySelector("[data-user-dialog]");
  const form = document.querySelector("[data-user-form]");
  const formMessage = document.querySelector("[data-user-form-message]");
  const codeDialog = document.querySelector("[data-activation-code-dialog]");
  const state = { users: [], permissions: [], loaded: false, activationText: "" };

  if (!list || !dialog || !form || !codeDialog) {
    return { activate() {}, reset() {} };
  }

  function updateStats() {
    const values = {
      total: state.users.length,
      active: state.users.filter((user) => user.status === "active").length,
      pending: state.users.filter((user) => user.status === "pending").length,
      disabled: state.users.filter((user) => user.status === "disabled").length
    };
    Object.entries(values).forEach(([key, value]) => {
      const output = document.querySelector(`[data-user-stat="${key}"]`);
      if (output) output.textContent = `${value}명`;
    });
  }

  function permissionLabels(user) {
    if (user.role === "owner") return ["모든 업무"];
    const labels = new Map(state.permissions.map((permission) => [permission.id, permission.label]));
    return (user.permissions || []).map((permission) => labels.get(permission)).filter(Boolean);
  }

  function renderUser(user) {
    const row = element("article", "employee-row");
    row.dataset.userId = user.id;

    const identity = element("div", "employee-identity");
    identity.append(element("span", "employee-avatar", initials(user.name)));
    const identityCopy = element("span");
    identityCopy.append(element("strong", "", user.name));
    identityCopy.append(element("small", "", `${user.title || "직원"} · ${user.role === "owner" ? "총책임자" : "직원"}`));
    identity.append(identityCopy);

    const phone = element("div", "employee-phone");
    phone.append(element("strong", "", user.phoneFormatted || user.phone));
    phone.append(element("small", "", user.lastLoginAt ? `최근 접속 ${formatDateTime(user.lastLoginAt)}` : "아직 로그인하지 않음"));

    const permissions = element("div", "employee-permissions");
    const labels = permissionLabels(user);
    if (!labels.length) permissions.append(element("span", "permission-chip is-empty", "권한 미지정"));
    labels.forEach((label) => permissions.append(element("span", "permission-chip", label)));

    const status = element("div", "employee-status");
    const meta = statusMeta[user.status] || statusMeta.pending;
    status.append(element("span", `employee-status-pill ${meta.className}`, meta.label));

    const actions = element("div", "employee-actions");
    if (user.protected) {
      actions.append(element("span", "protected-account", "기본 총책임자 계정"));
    } else {
      actions.append(makeAction("수정", "edit", "pencil"));
      actions.append(makeAction(user.status === "disabled" ? "사용 재개" : "사용 중지", "toggle", user.status === "disabled" ? "user-check" : "ban"));
      actions.append(makeAction("비밀번호 재등록", "reset", "key-round"));
    }

    row.append(identity, phone, permissions, status, actions);
    return row;
  }

  function render() {
    list.replaceChildren(...state.users.map(renderUser));
    if (!state.users.length) {
      list.append(element("div", "employee-loading", "등록된 계정이 없습니다."));
    }
    updateStats();
    refreshIcons();
  }

  function setDialogMode(user = null) {
    form.reset();
    formMessage.textContent = "";
    const editing = Boolean(user);
    form.elements.id.value = user?.id || "";
    form.elements.name.value = user?.name || "";
    form.elements.title.value = user?.title || "";
    form.elements.phone.value = user?.phoneFormatted || "";
    form.elements.phone.readOnly = editing;
    form.querySelectorAll('input[name="permissions"]').forEach((checkbox) => {
      checkbox.checked = editing
        ? (user.permissions || []).includes(checkbox.value)
        : ["estimate", "worklog", "documents"].includes(checkbox.value);
    });
    dialog.querySelector("[data-user-dialog-title]").textContent = editing ? "직원 권한 수정" : "직원 등록";
    dialog.querySelector("[data-user-submit] span").textContent = editing ? "변경 저장" : "등록코드 발급";
  }

  function openDialog(user = null) {
    setDialogMode(user);
    dialog.showModal();
    window.setTimeout(() => form.elements.name.focus(), 80);
  }

  function showActivation(result) {
    const user = result.user;
    const expires = result.user.activationExpiresAt
      ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(new Date(result.user.activationExpiresAt))
      : "7일 이내";
    codeDialog.querySelector("[data-activation-user-name]").textContent = user.name;
    codeDialog.querySelector("[data-activation-user-phone]").textContent = user.phoneFormatted || user.phone;
    codeDialog.querySelector("[data-activation-code]").textContent = result.activationCode;
    codeDialog.querySelector("[data-activation-expiry]").textContent = `등록기한: ${expires}까지`;
    state.activationText = `[SN 업무포털 최초 등록]\n아이디: ${user.phone}\n등록코드: ${result.activationCode}\n접속: https://snplus.ai.kr/admin`;
    codeDialog.showModal();
  }

  async function load({ notify = false } = {}) {
    try {
      const payload = await fetchJson("/api/admin/users");
      state.users = payload.users || [];
      state.permissions = payload.permissions || [];
      state.loaded = true;
      render();
      if (notify) showToast("직원 계정 정보를 새로 확인했습니다.");
    } catch (error) {
      if ([401, 403].includes(error.status)) onUnauthorized(error);
      else {
        list.replaceChildren(element("div", "employee-loading is-error", error.message || "직원 계정을 불러오지 못했습니다."));
      }
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage.textContent = "";
    const submit = form.querySelector("[data-user-submit]");
    const data = new FormData(form);
    const editing = Boolean(data.get("id"));
    const payload = {
      id: String(data.get("id") || ""),
      phone: String(data.get("phone") || ""),
      name: String(data.get("name") || "").trim(),
      title: String(data.get("title") || "").trim(),
      permissions: data.getAll("permissions")
    };
    if (!payload.name || (!editing && payload.phone.replace(/\D/g, "").length < 10)) {
      formMessage.textContent = "직원 이름과 전화번호를 확인해 주세요.";
      return;
    }

    submit.disabled = true;
    try {
      const result = await fetchJson("/api/admin/users", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      dialog.close();
      await load();
      if (editing) showToast("직원 정보와 권한을 저장했습니다.");
      else showActivation(result);
    } catch (error) {
      if ([401, 403].includes(error.status)) onUnauthorized(error);
      else formMessage.textContent = error.message || "직원 계정을 저장하지 못했습니다.";
    } finally {
      submit.disabled = false;
    }
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-user-action]");
    const row = button?.closest("[data-user-id]");
    const user = state.users.find((item) => item.id === row?.dataset.userId);
    if (!button || !user) return;

    if (button.dataset.userAction === "edit") {
      openDialog(user);
      return;
    }

    if (button.dataset.userAction === "toggle") {
      const enabling = user.status === "disabled";
      const confirmed = window.confirm(enabling
        ? `${user.name} 계정 사용을 다시 허용할까요?`
        : `${user.name} 계정을 사용 중지할까요? 퇴사·휴직 처리 후에는 기존 로그인도 차단됩니다.`);
      if (!confirmed) return;
      try {
        await fetchJson("/api/admin/users", {
          method: "PATCH",
          body: JSON.stringify({ id: user.id, status: enabling ? "active" : "disabled" })
        });
        await load();
        showToast(enabling ? "직원 계정 사용을 다시 허용했습니다." : "직원 계정을 사용 중지했습니다.");
      } catch (error) {
        if ([401, 403].includes(error.status)) onUnauthorized(error);
        else showToast(error.message || "계정 상태를 변경하지 못했습니다.");
      }
      return;
    }

    if (button.dataset.userAction === "reset") {
      if (!window.confirm(`${user.name}의 기존 비밀번호를 무효화하고 새 등록코드를 발급할까요?`)) return;
      try {
        const result = await fetchJson("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ action: "reset", id: user.id })
        });
        await load();
        showActivation(result);
      } catch (error) {
        if ([401, 403].includes(error.status)) onUnauthorized(error);
        else showToast(error.message || "새 등록코드를 발급하지 못했습니다.");
      }
    }
  });

  document.querySelector("[data-user-new]")?.addEventListener("click", () => openDialog());
  document.querySelector("[data-user-refresh]")?.addEventListener("click", () => load({ notify: true }));
  document.querySelectorAll("[data-user-dialog-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.querySelector("[data-activation-code-close]")?.addEventListener("click", () => codeDialog.close());
  codeDialog.addEventListener("click", (event) => { if (event.target === codeDialog) codeDialog.close(); });
  document.querySelector("[data-activation-code-copy]")?.addEventListener("click", async () => {
    try {
      await copyText(state.activationText);
      showToast("직원 아이디와 등록코드를 복사했습니다.");
    } catch {
      showToast("복사하지 못했습니다. 화면의 코드를 직접 전달해 주세요.");
    }
  });

  return {
    activate() {
      if (!state.loaded) load();
    },
    reset() {
      state.users = [];
      state.loaded = false;
    },
    enablePreview() {
      state.permissions = [
        { id: "estimate", label: "견적 관리·문서 작성" },
        { id: "tax", label: "세무·회계" },
        { id: "clients", label: "거래처" },
        { id: "worklog", label: "일정·현장 업무일지" },
        { id: "documents", label: "업무 서식·사내 자료" }
      ];
      state.users = [
        { id: "01000000000", phone: "01000000000", phoneFormatted: "010-0000-0000", name: "총책임자", title: "총책임자", role: "owner", status: "active", permissions: state.permissions.map((item) => item.id), protected: true, lastLoginAt: new Date().toISOString() },
        { id: "01011112222", phone: "01011112222", phoneFormatted: "010-1111-2222", name: "권한 직원", title: "이사", role: "staff", status: "active", permissions: ["estimate", "clients", "worklog", "documents"], lastLoginAt: new Date(Date.now() - 3600000).toISOString() },
        { id: "01033334444", phone: "01033334444", phoneFormatted: "010-3333-4444", name: "신규 직원", title: "사원", role: "staff", status: "pending", permissions: ["worklog"], lastLoginAt: null }
      ];
      state.loaded = true;
      render();
    }
  };
}
