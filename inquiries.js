const STATUS_LABELS = Object.freeze({
  new: "신규",
  contacted: "연락 완료",
  quoted: "견적 발송",
  closed: "종결",
  spam: "스팸"
});

const MAIL_LABELS = Object.freeze({
  sent: "메일 발송",
  pending: "메일 확인 중",
  not_configured: "메일 미설정",
  failed: "메일 실패",
  skipped: "메일 생략"
});

const state = {
  entries: [],
  summary: {},
  filter: "all",
  query: "",
  loading: false
};

const listNode = document.querySelector("[data-inquiry-list]");
const emptyNode = document.querySelector("[data-empty-state]");
const authNode = document.querySelector("[data-auth-state]");
const systemStateNode = document.querySelector("[data-system-state]");
const refreshButton = document.querySelector("[data-refresh]");
const statusFilter = document.querySelector("[data-status-filter]");
const searchInput = document.querySelector("[data-search]");
const resultCount = document.querySelector("[data-result-count]");

function makeElement(tagName, className = "", text = "") {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== "") node.textContent = text;
  return node;
}

function setSystemState(message, tone = "") {
  systemStateNode.textContent = message;
  if (tone) systemStateNode.dataset.tone = tone;
  else delete systemStateNode.dataset.tone;
}

function formatDate(value) {
  if (!value) return "시간 미확인";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
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

function cleanPhone(value) {
  const phone = String(value ?? "").replace(/[^0-9+]/g, "");
  return phone.length >= 8 ? phone : "";
}

function validEmail(value) {
  const email = String(value ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function addMeta(container, value) {
  if (!value) return;
  container.append(makeElement("span", "", String(value)));
}

function detailItem(label, value) {
  const item = makeElement("div", "detail-item");
  item.append(makeElement("span", "", label));
  item.append(makeElement("strong", "", value || "-"));
  return item;
}

function statusBadge(status) {
  const normalized = STATUS_LABELS[status] ? status : "new";
  const badge = makeElement("span", "status-badge", STATUS_LABELS[normalized]);
  badge.dataset.status = normalized;
  return badge;
}

function mailBadge(notification) {
  const status = MAIL_LABELS[notification?.status] ? notification.status : "pending";
  const badge = makeElement("span", "mail-badge", MAIL_LABELS[status]);
  badge.dataset.mail = status;
  const errorCode = String(notification?.errorCode ?? "").trim();
  if (errorCode) badge.title = errorCode;
  return badge;
}

function contactLink(label, href, primary = false) {
  const link = makeElement("a", `contact-link${primary ? " contact-link-primary" : ""}`, label);
  link.href = href;
  return link;
}

function buildSourceText(entry) {
  const campaign = [
    entry.utmSource && `source=${entry.utmSource}`,
    entry.utmMedium && `medium=${entry.utmMedium}`,
    entry.utmCampaign && `campaign=${entry.utmCampaign}`,
    entry.utmTerm && `term=${entry.utmTerm}`,
    entry.utmContent && `content=${entry.utmContent}`
  ].filter(Boolean).join(" · ");
  return campaign || entry.referrer || "직접 유입 또는 유입정보 미확인";
}

async function updateStatus(entry, selectNode) {
  const nextStatus = selectNode.value;
  const previousStatus = entry.status;
  selectNode.disabled = true;

  try {
    const response = await fetch("/api/admin/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: entry.leadId, status: nextStatus })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.message || "처리상태를 저장하지 못했습니다.");

    const index = state.entries.findIndex((item) => item.leadId === entry.leadId);
    if (index >= 0) state.entries[index] = payload.entry;
    recalculateSummary();
    render();
    setSystemState(`${entry.leadId} 처리상태를 '${STATUS_LABELS[nextStatus]}'로 저장했습니다.`, "success");
  } catch (error) {
    selectNode.value = previousStatus;
    setSystemState(error.message || "처리상태를 저장하지 못했습니다.", "error");
  } finally {
    selectNode.disabled = false;
  }
}

function renderInquiry(entry) {
  const article = makeElement("article", "inquiry-card");
  article.dataset.status = entry.status || "new";

  const head = makeElement("div", "inquiry-card-head");
  const titleArea = makeElement("div");
  const titleRow = makeElement("div", "inquiry-card-title");
  titleRow.append(makeElement("h2", "", entry.companyName || "회사·현장명 미입력"));
  titleRow.append(statusBadge(entry.status));
  titleRow.append(mailBadge(entry.notification));
  titleArea.append(titleRow);

  const meta = makeElement("div", "inquiry-meta");
  addMeta(meta, entry.leadId);
  addMeta(meta, formatDate(entry.storedAt));
  addMeta(meta, entry.inquiryType || entry.requestKind);
  addMeta(meta, entry.region);
  titleArea.append(meta);
  head.append(titleArea);

  const statusControl = makeElement("div", "status-control");
  const label = makeElement("label", "", "처리상태");
  label.htmlFor = `status-${entry.leadId}`;
  const select = makeElement("select", "status-select");
  select.id = `status-${entry.leadId}`;
  for (const [status, statusLabel] of Object.entries(STATUS_LABELS)) {
    const option = makeElement("option", "", statusLabel);
    option.value = status;
    option.selected = status === entry.status;
    select.append(option);
  }
  select.addEventListener("change", () => updateStatus(entry, select));
  statusControl.append(label, select);
  head.append(statusControl);
  article.append(head);

  const body = makeElement("div", "inquiry-card-body");
  const primaryColumn = makeElement("div");
  const messageSection = makeElement("section", "inquiry-section");
  messageSection.append(makeElement("h3", "", "문의내용"));
  messageSection.append(makeElement("p", "message-box", entry.message || "문의내용이 없습니다."));
  primaryColumn.append(messageSection);

  const detailsSection = makeElement("section", "inquiry-section");
  detailsSection.append(makeElement("h3", "", "현장·견적 정보"));
  const details = makeElement("div", "detail-grid");
  details.append(
    detailItem("담당자", entry.contactName),
    detailItem("연락처", entry.phone),
    detailItem("요청 구분", entry.requestKind || entry.inquiryType),
    detailItem("예상 수량", entry.quantity),
    detailItem("현장 유형", entry.siteType),
    detailItem("제품 방식", entry.productPreference),
    detailItem("선호 연락", entry.contactPreference),
    detailItem("문의 제목", entry.subject)
  );
  detailsSection.append(details);
  primaryColumn.append(detailsSection);
  body.append(primaryColumn);

  const sideColumn = makeElement("aside");
  const contactSection = makeElement("section", "inquiry-section");
  contactSection.append(makeElement("h3", "", "바로 연락"));
  const actions = makeElement("div", "contact-actions");
  const phone = cleanPhone(entry.phone);
  if (phone) actions.append(contactLink(`전화 ${entry.phone}`, `tel:${phone}`, true));
  const email = validEmail(entry.email);
  if (email) actions.append(contactLink("이메일 보내기", `mailto:${email}`));
  if (!phone && !email) actions.append(makeElement("span", "contact-link", "연락처 없음"));
  contactSection.append(actions);
  sideColumn.append(contactSection);

  if (Array.isArray(entry.photos) && entry.photos.length) {
    const photoSection = makeElement("section", "inquiry-section");
    photoSection.append(makeElement("h3", "", `현장사진 ${entry.photos.length}장`));
    const grid = makeElement("div", "photo-grid");
    for (const photo of entry.photos) {
      const path = String(photo.path ?? "");
      const url = `/api/admin/inquiry-photo?path=${encodeURIComponent(path)}`;
      const link = makeElement("a", "photo-link");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      const image = document.createElement("img");
      image.src = url;
      image.alt = photo.name || "견적문의 현장사진";
      image.loading = "lazy";
      const caption = makeElement("span", "", photo.name || "현장사진");
      link.append(image, caption);
      grid.append(link);
    }
    photoSection.append(grid);
    sideColumn.append(photoSection);
  }

  const sourceSection = makeElement("section", "inquiry-section");
  sourceSection.append(makeElement("h3", "", "광고·유입 경로"));
  sourceSection.append(makeElement("div", "source-box", buildSourceText(entry)));
  sideColumn.append(sourceSection);
  body.append(sideColumn);
  article.append(body);

  return article;
}

function filteredEntries() {
  const query = state.query.trim().toLocaleLowerCase("ko");
  return state.entries.filter((entry) => {
    if (state.filter !== "all" && entry.status !== state.filter) return false;
    if (!query) return true;
    const haystack = [
      entry.leadId,
      entry.companyName,
      entry.contactName,
      entry.phone,
      entry.email,
      entry.inquiryType,
      entry.requestKind,
      entry.region,
      entry.quantity,
      entry.siteType,
      entry.subject,
      entry.message,
      entry.utmTerm
    ].join(" ").toLocaleLowerCase("ko");
    return haystack.includes(query);
  });
}

function recalculateSummary() {
  const summary = { total: state.entries.length, new: 0, contacted: 0, quoted: 0, closed: 0, spam: 0 };
  for (const entry of state.entries) {
    if (Object.hasOwn(summary, entry.status)) summary[entry.status] += 1;
  }
  state.summary = summary;
  updateSummary();
}

function updateSummary() {
  for (const node of document.querySelectorAll("[data-summary]")) {
    node.textContent = String(state.summary[node.dataset.summary] ?? 0);
  }
}

function render() {
  const entries = filteredEntries();
  listNode.replaceChildren(...entries.map(renderInquiry));
  listNode.setAttribute("aria-busy", "false");
  resultCount.textContent = String(entries.length);
  emptyNode.hidden = entries.length > 0 || state.loading;
}

function renderLoading() {
  listNode.setAttribute("aria-busy", "true");
  listNode.replaceChildren(
    makeElement("div", "loading-card"),
    makeElement("div", "loading-card")
  );
  emptyNode.hidden = true;
}

async function loadInquiries() {
  if (state.loading) return;
  state.loading = true;
  refreshButton.disabled = true;
  authNode.hidden = true;
  renderLoading();
  setSystemState("Private Blob 문의함을 확인하고 있습니다.");

  try {
    const response = await fetch("/api/admin/inquiries", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      listNode.replaceChildren();
      authNode.hidden = false;
      emptyNode.hidden = true;
      setSystemState("관리자 로그인 후 문의 내용을 확인할 수 있습니다.", "error");
      return;
    }
    if (!response.ok || !payload.ok) throw new Error(payload.message || "문의함을 불러오지 못했습니다.");

    state.entries = Array.isArray(payload.entries) ? payload.entries : [];
    state.summary = payload.summary || {};
    updateSummary();
    render();

    const pending = Number(payload.summary?.mailPending ?? 0);
    const message = pending > 0
      ? `저장소 정상 · ${state.entries.length}건 보관 · 메일 알림 미완료 ${pending}건`
      : `저장소 정상 · ${state.entries.length}건 보관 · 메일 알림 정상`;
    setSystemState(message, "success");
  } catch (error) {
    state.entries = [];
    state.summary = {};
    updateSummary();
    listNode.replaceChildren();
    emptyNode.hidden = true;
    setSystemState(error.message || "문의함을 불러오지 못했습니다.", "error");
  } finally {
    state.loading = false;
    refreshButton.disabled = false;
    listNode.setAttribute("aria-busy", "false");
  }
}

statusFilter.addEventListener("change", () => {
  state.filter = statusFilter.value;
  render();
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  render();
});

refreshButton.addEventListener("click", loadInquiries);

loadInquiries();
