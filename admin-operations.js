const MAX_UPLOAD_BYTES = 1.8 * 1024 * 1024;

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function newId(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function displayDate(value, options = {}) {
  const date = value ? parseDate(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "날짜 미지정";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", ...options }).format(date);
}

function displayDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function number(value) {
  return Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

function setButtonBusy(button, busy, text) {
  if (!button) return;
  button.disabled = busy;
  const label = button.querySelector("span");
  if (!label) return;
  if (!button.dataset.idleLabel) button.dataset.idleLabel = label.textContent;
  label.textContent = busy ? text : button.dataset.idleLabel;
}

function formValue(form, name) {
  return String(new FormData(form).get(name) ?? "").trim();
}

export function buildInventoryMovementPayload({ itemId, movementType, quantity, note }) {
  return {
    type: "inventory-movement",
    itemId: String(itemId ?? "").trim(),
    movementType: String(movementType ?? "").trim(),
    quantity: Number(quantity || 0),
    note: String(note ?? "").trim()
  };
}

function closeOnBackdrop(dialog, close) {
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
}

function previewData() {
  const today = todayKey();
  return {
    estimates: [
      { id: "preview-estimate-a", date: today, title: "디자인난간 제작·설치", clientName: "거래처 예시", contactName: "담당자", contactPhone: "", memo: "", updatedAt: new Date().toISOString() }
    ],
    production: [
      { id: "preview-production-a", date: today, title: "난간 프레임 제작", drawingNumber: "SN-EXAMPLE-01", workers: "생산팀", shipped: false, memo: "용접 상태와 치수를 확인했습니다.", updatedAt: new Date().toISOString() }
    ],
    inventory: [
      { id: "preview-inventory-a", name: "볼라드 완제품", spec: "예시 규격", quantity: 24, unit: "개", location: "공장 A구역", photo: null, memo: "", updatedAt: new Date().toISOString() }
    ],
    movements: []
  };
}

export function setupOperations({ fetchJson, showToast, refreshIcons, onUnauthorized }) {
  const state = {
    preview: false,
    estimate: { entries: [], loaded: false, selectedDate: todayKey(), visibleMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    production: { entries: [], loaded: false, filter: "all" },
    inventory: { items: [], movements: [], loaded: false, formPhoto: null, pendingPhoto: null }
  };

  const estimateDialog = document.querySelector("[data-estimate-dialog]");
  const estimateForm = document.querySelector("[data-estimate-form]");
  const estimateDelete = document.querySelector("[data-estimate-delete]");
  const estimateSubmit = document.querySelector("[data-estimate-submit]");
  const productionDialog = document.querySelector("[data-production-dialog]");
  const productionForm = document.querySelector("[data-production-form]");
  const productionDelete = document.querySelector("[data-production-delete]");
  const productionSubmit = document.querySelector("[data-production-submit]");
  const inventoryDialog = document.querySelector("[data-inventory-dialog]");
  const inventoryForm = document.querySelector("[data-inventory-form]");
  const inventoryDelete = document.querySelector("[data-inventory-delete]");
  const inventorySubmit = document.querySelector("[data-inventory-submit]");
  const inventoryPhotoInput = document.querySelector("[data-inventory-photo-input]");
  const inventoryPhotoPreview = document.querySelector("[data-inventory-photo-preview]");
  const movementDialog = document.querySelector("[data-movement-dialog]");
  const movementForm = document.querySelector("[data-movement-form]");
  const movementSubmit = document.querySelector("[data-movement-submit]");

  function handleError(error, fallback) {
    if ([401, 403].includes(error?.status)) onUnauthorized?.(error);
    showToast(error?.message || fallback);
  }

  function updateEstimateStats(summary = null) {
    const today = todayKey();
    const values = summary || {
      total: state.estimate.entries.length,
      today: state.estimate.entries.filter((entry) => entry.date === today).length,
      month: state.estimate.entries.filter((entry) => entry.date?.startsWith(today.slice(0, 7))).length
    };
    Object.entries(values).forEach(([key, value]) => {
      const output = document.querySelector(`[data-estimate-stat="${key}"]`);
      if (output) output.textContent = `${value}건`;
    });
  }

  function estimateCalendarEntries(date) {
    return state.estimate.entries.filter((entry) => entry.date === date);
  }

  function renderEstimateCalendar() {
    const calendar = document.querySelector("[data-estimate-calendar]");
    const label = document.querySelector("[data-estimate-month-label]");
    if (!calendar || !label) return;
    const year = state.estimate.visibleMonth.getFullYear();
    const month = state.estimate.visibleMonth.getMonth();
    label.textContent = `${year}년 ${month + 1}월`;
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = dateKey(date);
      const entries = estimateCalendarEntries(key);
      const classes = ["operation-calendar-day"];
      if (date.getMonth() !== month) classes.push("is-outside");
      if (key === todayKey()) classes.push("is-today");
      if (key === state.estimate.selectedDate) classes.push("is-selected");
      cells.push(`<button class="${classes.join(" ")}" type="button" data-estimate-date="${key}" role="gridcell" aria-label="${key}, 견적 ${entries.length}건"><span>${date.getDate()}</span>${entries.length ? `<small><b>${entries.length}</b>건</small>` : ""}</button>`);
    }
    calendar.innerHTML = cells.join("");
  }

  function estimateEntryMarkup(entry) {
    const contact = [entry.contactName, entry.contactPhone].filter(Boolean).join(" · ");
    return `<article class="operation-entry" data-operation-id="${escapeHtml(entry.id)}"><div class="operation-entry-main"><div><strong>${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.clientName || "거래처 미지정")}${contact ? ` · ${escapeHtml(contact)}` : ""}</p>${entry.memo ? `<small>${escapeHtml(entry.memo)}</small>` : ""}</div></div><button class="operation-edit" type="button" data-estimate-edit="${escapeHtml(entry.id)}" aria-label="견적 일정 수정"><i data-lucide="pencil"></i></button></article>`;
  }

  function renderEstimateList() {
    const list = document.querySelector("[data-estimate-list]");
    const label = document.querySelector("[data-estimate-selected-label]");
    if (!list || !label) return;
    label.textContent = displayDate(state.estimate.selectedDate);
    const entries = estimateCalendarEntries(state.estimate.selectedDate).sort((left, right) => left.title.localeCompare(right.title, "ko"));
    list.innerHTML = entries.length
      ? entries.map(estimateEntryMarkup).join("")
      : `<div class="operation-empty compact"><i data-lucide="calendar-days"></i><strong>선택한 날짜의 견적이 없습니다.</strong><span>오른쪽 위 추가 버튼으로 등록하세요.</span></div>`;
    refreshIcons();
  }

  function renderEstimates(summary = null) {
    renderEstimateCalendar();
    renderEstimateList();
    updateEstimateStats(summary);
  }

  async function loadEstimates() {
    try {
      if (state.preview) {
        state.estimate.entries = previewData().estimates;
        state.estimate.loaded = true;
        renderEstimates();
        return;
      }
      const payload = await fetchJson("/api/admin/operations?type=estimate");
      state.estimate.entries = payload.entries || [];
      state.estimate.loaded = true;
      renderEstimates(payload.summary);
    } catch (error) {
      handleError(error, "견적 일정을 불러오지 못했습니다.");
    }
  }

  function openEstimate(entry = null) {
    estimateForm.reset();
    const values = entry || { id: newId("estimate"), date: state.estimate.selectedDate };
    Object.entries(values).forEach(([key, value]) => {
      const field = estimateForm.elements.namedItem(key);
      if (field && typeof value !== "object") field.value = value ?? "";
    });
    estimateDialog.querySelector("[data-estimate-dialog-title]").textContent = entry ? "견적 일정 수정" : "견적 일정 등록";
    estimateDelete.hidden = !entry || state.preview;
    estimateDialog.showModal();
    window.setTimeout(() => estimateForm.elements.namedItem("title")?.focus(), 50);
  }

  function closeEstimate() {
    estimateDialog.close();
  }

  function updateProductionStats(summary = null) {
    const values = summary || {
      total: state.production.entries.length,
      today: state.production.entries.filter((entry) => entry.date === todayKey()).length,
      waiting: state.production.entries.filter((entry) => !entry.shipped).length,
      shipped: state.production.entries.filter((entry) => entry.shipped).length
    };
    Object.entries(values).forEach(([key, value]) => {
      const output = document.querySelector(`[data-production-stat="${key}"]`);
      if (output) output.textContent = `${value}건`;
    });
  }

  function productionEntryMarkup(entry) {
    const drawing = entry.drawingNumber ? `<span><i data-lucide="file-text"></i>${escapeHtml(entry.drawingNumber)}</span>` : "";
    const workers = entry.workers ? `<span><i data-lucide="users"></i>${escapeHtml(entry.workers)}</span>` : "";
    return `<article class="production-entry"><div class="production-date"><strong>${escapeHtml(entry.date.slice(5).replace("-", "."))}</strong><small>${entry.shipped ? "생산완료" : "생산중"}</small></div><div class="production-copy"><div><span class="operation-status ${entry.shipped ? "is-completed" : "is-estimating"}">${entry.shipped ? "생산완료" : "생산중"}</span><strong>${escapeHtml(entry.title)}</strong></div><p>${drawing}${workers}</p>${entry.memo ? `<small>${escapeHtml(entry.memo)}</small>` : ""}</div><button class="operation-edit" type="button" data-production-edit="${escapeHtml(entry.id)}" aria-label="생산일보 수정"><i data-lucide="pencil"></i></button></article>`;
  }

  function renderProduction(summary = null) {
    const list = document.querySelector("[data-production-list]");
    if (!list) return;
    const entries = state.production.entries
      .filter((entry) => state.production.filter === "all" || (state.production.filter === "shipped" ? entry.shipped : !entry.shipped))
      .sort((left, right) => `${right.date}${right.updatedAt}`.localeCompare(`${left.date}${left.updatedAt}`));
    list.innerHTML = entries.length
      ? entries.map(productionEntryMarkup).join("")
      : `<div class="operation-empty"><i data-lucide="factory"></i><strong>표시할 생산일보가 없습니다.</strong><span>생산 작업을 등록하거나 필터를 변경해 주세요.</span></div>`;
    updateProductionStats(summary);
    refreshIcons();
  }

  async function loadProduction() {
    try {
      if (state.preview) {
        state.production.entries = previewData().production;
        state.production.loaded = true;
        renderProduction();
        return;
      }
      const payload = await fetchJson("/api/admin/operations?type=production");
      state.production.entries = payload.entries || [];
      state.production.loaded = true;
      renderProduction(payload.summary);
    } catch (error) {
      handleError(error, "생산일보를 불러오지 못했습니다.");
    }
  }

  function openProduction(entry = null) {
    productionForm.reset();
    const values = entry || { id: newId("production"), date: todayKey(), shipped: false };
    Object.entries(values).forEach(([key, value]) => {
      const field = productionForm.elements.namedItem(key);
      if (!field || typeof value === "object") return;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value ?? "";
    });
    productionDialog.querySelector("[data-production-dialog-title]").textContent = entry ? "생산일보 수정" : "생산일보 등록";
    productionDelete.hidden = !entry || state.preview;
    productionDialog.showModal();
    window.setTimeout(() => productionForm.elements.namedItem("title")?.focus(), 50);
  }

  function closeProduction() {
    productionDialog.close();
  }

  function inventoryPhotoUrl(photo) {
    return photo?.previewUrl || (photo?.path ? `/api/admin/inventory-photo?path=${encodeURIComponent(photo.path)}` : "");
  }

  function inventoryCardMarkup(item) {
    const photo = item.photo ? `<img src="${escapeHtml(inventoryPhotoUrl(item.photo))}" alt="${escapeHtml(item.name)} 제품사진" loading="lazy" />` : `<span class="inventory-photo-empty"><i data-lucide="package"></i></span>`;
    return `<article class="inventory-card"><figure>${photo}</figure><div class="inventory-card-body"><div><span class="inventory-location"><i data-lucide="map-pin"></i>${escapeHtml(item.location || "위치 미지정")}</span><button class="operation-edit" type="button" data-inventory-edit="${escapeHtml(item.id)}" aria-label="재고 제품 수정"><i data-lucide="pencil"></i></button></div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.spec || "규격 미지정")}</p><strong>${number(item.quantity)} <small>${escapeHtml(item.unit)}</small></strong><div class="inventory-actions"><button type="button" data-inventory-move="${escapeHtml(item.id)}" data-movement-type="in"><i data-lucide="package-plus"></i>입고</button><button type="button" data-inventory-move="${escapeHtml(item.id)}" data-movement-type="out"><i data-lucide="package-minus"></i>출고</button></div></div></article>`;
  }

  function movementMarkup(movement) {
    const typeLabel = movement.type === "in" ? "입고" : "출고";
    return `<article class="movement-entry"><span class="movement-type is-${movement.type}">${typeLabel}</span><div><strong>${escapeHtml(movement.itemName)}</strong><p>${number(movement.quantity)} ${escapeHtml(movement.unit)} · ${number(movement.previousQuantity)} → ${number(movement.nextQuantity)}</p>${movement.note ? `<small>${escapeHtml(movement.note)}</small>` : ""}</div><time>${escapeHtml(displayDateTime(movement.createdAt))}</time></article>`;
  }

  function updateInventoryStats(summary = null) {
    const currentMonth = todayKey().slice(0, 7);
    const values = summary || {
      items: state.inventory.items.length,
      totalQuantity: state.inventory.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      monthIn: state.inventory.movements.filter((item) => item.type === "in" && item.createdAt?.startsWith(currentMonth)).length,
      monthOut: state.inventory.movements.filter((item) => item.type === "out" && item.createdAt?.startsWith(currentMonth)).length
    };
    Object.entries(values).forEach(([key, value]) => {
      const output = document.querySelector(`[data-inventory-stat="${key}"]`);
      if (output) output.textContent = key === "items" ? `${value}종` : key === "totalQuantity" ? number(value) : `${value}건`;
    });
  }

  function renderInventory(summary = null) {
    const list = document.querySelector("[data-inventory-list]");
    const movements = document.querySelector("[data-inventory-movements]");
    if (!list || !movements) return;
    list.innerHTML = state.inventory.items.length
      ? state.inventory.items.map(inventoryCardMarkup).join("")
      : `<div class="operation-empty inventory-empty-wide"><i data-lucide="package"></i><strong>등록된 제품이 없습니다.</strong><span>제품사진과 시작 수량을 등록해 주세요.</span></div>`;
    movements.innerHTML = state.inventory.movements.length
      ? state.inventory.movements.slice(0, 50).map(movementMarkup).join("")
      : `<div class="operation-empty compact"><strong>입출고 기록이 없습니다.</strong></div>`;
    updateInventoryStats(summary);
    refreshIcons();
  }

  async function loadInventory() {
    try {
      if (state.preview) {
        const preview = previewData();
        state.inventory.items = preview.inventory;
        state.inventory.movements = preview.movements;
        state.inventory.loaded = true;
        renderInventory();
        return;
      }
      const payload = await fetchJson("/api/admin/operations?type=inventory");
      state.inventory.items = payload.items || [];
      state.inventory.movements = payload.movements || [];
      state.inventory.loaded = true;
      renderInventory(payload.summary);
    } catch (error) {
      handleError(error, "재고 정보를 불러오지 못했습니다.");
    }
  }

  function revokePendingPhoto() {
    if (state.inventory.pendingPhoto?.previewUrl) URL.revokeObjectURL(state.inventory.pendingPhoto.previewUrl);
    state.inventory.pendingPhoto = null;
  }

  function renderInventoryPhoto() {
    const photo = state.inventory.pendingPhoto || state.inventory.formPhoto;
    inventoryPhotoPreview.innerHTML = photo
      ? `<figure><img src="${escapeHtml(inventoryPhotoUrl(photo))}" alt="제품사진 미리보기" /><button type="button" data-inventory-photo-remove aria-label="제품사진 제거"><i data-lucide="x"></i></button></figure>`
      : `<span><i data-lucide="package"></i> 제품사진을 등록해 주세요.</span>`;
    refreshIcons();
  }

  function openInventory(item = null) {
    revokePendingPhoto();
    inventoryForm.reset();
    const values = item || { id: newId("inventory"), quantity: 0, unit: "개" };
    Object.entries(values).forEach(([key, value]) => {
      const field = inventoryForm.elements.namedItem(key);
      if (field && typeof value !== "object") field.value = value ?? "";
    });
    state.inventory.formPhoto = item?.photo || null;
    const quantityField = inventoryForm.elements.namedItem("quantity");
    quantityField.readOnly = Boolean(item);
    inventoryForm.querySelector("[data-inventory-quantity-help]").textContent = item ? "수량은 입고·출고 버튼으로 변경합니다." : "등록 후 수량은 입고·출고로만 변경합니다.";
    inventoryDialog.querySelector("[data-inventory-dialog-title]").textContent = item ? "재고 제품 수정" : "재고 제품 등록";
    inventoryDelete.hidden = !item || state.preview;
    renderInventoryPhoto();
    inventoryDialog.showModal();
    window.setTimeout(() => inventoryForm.elements.namedItem("name")?.focus(), 50);
  }

  function closeInventory() {
    revokePendingPhoto();
    inventoryDialog.close();
  }

  function openMovement(item, type = "in") {
    movementForm.reset();
    movementForm.elements.namedItem("itemId").value = item.id;
    movementForm.elements.namedItem("movementType").value = type;
    movementDialog.querySelector("[data-movement-item-name]").textContent = item.name;
    movementDialog.querySelector("[data-movement-current]").textContent = `현재 ${number(item.quantity)} ${item.unit}`;
    movementDialog.showModal();
    window.setTimeout(() => movementForm.elements.namedItem("quantity")?.focus(), 50);
  }

  function closeMovement() {
    movementForm.reset();
    movementDialog.close();
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("PHOTO_DECODE_FAILED")); };
      image.src = url;
    });
  }

  function canvasBlob(canvas, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  }

  async function optimizePhoto(file) {
    const image = await loadImage(file);
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1400 / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob = await canvasBlob(canvas, 0.82);
    if (blob?.size > MAX_UPLOAD_BYTES) blob = await canvasBlob(canvas, 0.65);
    if (blob?.size > MAX_UPLOAD_BYTES) blob = await canvasBlob(canvas, 0.5);
    if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error("PHOTO_TOO_LARGE");
    return { blob, name: `${file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "제품사진"}.jpg`, previewUrl: URL.createObjectURL(blob) };
  }

  async function uploadInventoryPhoto(photo, itemId) {
    const response = await fetch(`/api/admin/inventory-photo?itemId=${encodeURIComponent(itemId)}`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": photo.blob.type || "image/jpeg", "X-File-Name": encodeURIComponent(photo.name) },
      body: photo.blob
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.message || "제품사진을 등록하지 못했습니다.");
      error.status = response.status;
      throw error;
    }
    return payload.photo;
  }

  async function deleteUploadedPhoto(photo) {
    if (!photo?.path) return;
    await fetch(`/api/admin/inventory-photo?path=${encodeURIComponent(photo.path)}`, { method: "DELETE", credentials: "same-origin", cache: "no-store" });
  }

  document.querySelector("[data-estimate-calendar]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-estimate-date]");
    if (!button) return;
    state.estimate.selectedDate = button.dataset.estimateDate;
    renderEstimateCalendar();
    renderEstimateList();
  });

  document.querySelectorAll("[data-estimate-month]").forEach((button) => button.addEventListener("click", () => {
    state.estimate.visibleMonth = new Date(state.estimate.visibleMonth.getFullYear(), state.estimate.visibleMonth.getMonth() + (button.dataset.estimateMonth === "next" ? 1 : -1), 1);
    renderEstimateCalendar();
  }));
  document.querySelector("[data-estimate-today]")?.addEventListener("click", () => {
    const now = new Date();
    state.estimate.selectedDate = todayKey();
    state.estimate.visibleMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    renderEstimates();
  });
  document.querySelector("[data-estimate-list]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-estimate-edit]");
    if (button) openEstimate(state.estimate.entries.find((entry) => entry.id === button.dataset.estimateEdit) || null);
  });
  document.querySelectorAll('[data-operation-new="estimate"]').forEach((button) => button.addEventListener("click", () => openEstimate()));
  document.querySelectorAll("[data-estimate-close]").forEach((button) => button.addEventListener("click", closeEstimate));
  closeOnBackdrop(estimateDialog, closeEstimate);

  estimateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!estimateForm.reportValidity() || state.preview) return;
    setButtonBusy(estimateSubmit, true, "저장 중");
    try {
      await fetchJson("/api/admin/operations", { method: "POST", body: JSON.stringify({ type: "estimate", id: formValue(estimateForm, "id"), title: formValue(estimateForm, "title"), date: formValue(estimateForm, "date"), clientName: formValue(estimateForm, "clientName"), contactName: formValue(estimateForm, "contactName"), contactPhone: formValue(estimateForm, "contactPhone"), memo: formValue(estimateForm, "memo") }) });
      closeEstimate();
      await loadEstimates();
      showToast("견적 일정을 저장했습니다.");
    } catch (error) { handleError(error, "견적 일정을 저장하지 못했습니다."); }
    finally { setButtonBusy(estimateSubmit, false); }
  });

  estimateDelete?.addEventListener("click", async () => {
    const id = formValue(estimateForm, "id");
    if (!id || !window.confirm("이 견적 일정을 삭제할까요?")) return;
    try {
      await fetchJson(`/api/admin/operations?type=estimate&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      closeEstimate();
      await loadEstimates();
      showToast("견적 일정을 삭제했습니다.");
    } catch (error) { handleError(error, "견적 일정을 삭제하지 못했습니다."); }
  });

  document.querySelector("[data-production-list]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-production-edit]");
    if (button) openProduction(state.production.entries.find((entry) => entry.id === button.dataset.productionEdit) || null);
  });
  document.querySelectorAll("[data-production-filter]").forEach((button) => button.addEventListener("click", () => {
    state.production.filter = button.dataset.productionFilter;
    document.querySelectorAll("[data-production-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
    renderProduction();
  }));
  document.querySelectorAll('[data-operation-new="production"]').forEach((button) => button.addEventListener("click", () => openProduction()));
  document.querySelectorAll("[data-production-close]").forEach((button) => button.addEventListener("click", closeProduction));
  closeOnBackdrop(productionDialog, closeProduction);

  productionForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!productionForm.reportValidity() || state.preview) return;
    setButtonBusy(productionSubmit, true, "저장 중");
    try {
      await fetchJson("/api/admin/operations", { method: "POST", body: JSON.stringify({ type: "production", id: formValue(productionForm, "id"), title: formValue(productionForm, "title"), date: formValue(productionForm, "date"), drawingNumber: formValue(productionForm, "drawingNumber"), workers: formValue(productionForm, "workers"), shipped: productionForm.elements.namedItem("shipped").checked, memo: formValue(productionForm, "memo") }) });
      closeProduction();
      await loadProduction();
      showToast("생산일보를 저장했습니다.");
    } catch (error) { handleError(error, "생산일보를 저장하지 못했습니다."); }
    finally { setButtonBusy(productionSubmit, false); }
  });

  productionDelete?.addEventListener("click", async () => {
    const id = formValue(productionForm, "id");
    if (!id || !window.confirm("이 생산일보를 삭제할까요?")) return;
    try {
      await fetchJson(`/api/admin/operations?type=production&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      closeProduction();
      await loadProduction();
      showToast("생산일보를 삭제했습니다.");
    } catch (error) { handleError(error, "생산일보를 삭제하지 못했습니다."); }
  });

  document.querySelector("[data-inventory-list]")?.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-inventory-edit]");
    if (edit) {
      openInventory(state.inventory.items.find((item) => item.id === edit.dataset.inventoryEdit) || null);
      return;
    }
    const movement = event.target.closest("[data-inventory-move]");
    if (movement) {
      const item = state.inventory.items.find((entry) => entry.id === movement.dataset.inventoryMove);
      if (item) openMovement(item, movement.dataset.movementType);
    }
  });
  document.querySelectorAll('[data-operation-new="inventory"]').forEach((button) => button.addEventListener("click", () => openInventory()));
  document.querySelectorAll("[data-inventory-close]").forEach((button) => button.addEventListener("click", closeInventory));
  document.querySelectorAll("[data-movement-close]").forEach((button) => button.addEventListener("click", closeMovement));
  closeOnBackdrop(inventoryDialog, closeInventory);
  closeOnBackdrop(movementDialog, closeMovement);

  inventoryPhotoPreview?.addEventListener("click", (event) => {
    if (!event.target.closest("[data-inventory-photo-remove]")) return;
    revokePendingPhoto();
    state.inventory.formPhoto = null;
    renderInventoryPhoto();
  });
  inventoryPhotoInput?.addEventListener("change", async () => {
    const file = inventoryPhotoInput.files?.[0];
    inventoryPhotoInput.value = "";
    if (!file) return;
    try {
      revokePendingPhoto();
      state.inventory.pendingPhoto = await optimizePhoto(file);
      renderInventoryPhoto();
    } catch {
      showToast("이 사진은 처리하지 못했습니다. JPEG 사진으로 다시 선택해 주세요.");
    }
  });

  inventoryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!inventoryForm.reportValidity() || state.preview) return;
    const itemId = formValue(inventoryForm, "id");
    let uploaded = null;
    setButtonBusy(inventorySubmit, true, state.inventory.pendingPhoto ? "사진 저장 중" : "저장 중");
    try {
      if (state.inventory.pendingPhoto) uploaded = await uploadInventoryPhoto(state.inventory.pendingPhoto, itemId);
      await fetchJson("/api/admin/operations", { method: "POST", body: JSON.stringify({ type: "inventory", id: itemId, name: formValue(inventoryForm, "name"), spec: formValue(inventoryForm, "spec"), quantity: Number(formValue(inventoryForm, "quantity") || 0), unit: formValue(inventoryForm, "unit"), location: formValue(inventoryForm, "location"), photo: uploaded || state.inventory.formPhoto, memo: formValue(inventoryForm, "memo") }) });
      closeInventory();
      await loadInventory();
      showToast("재고 제품을 저장했습니다.");
    } catch (error) {
      if (uploaded) await deleteUploadedPhoto(uploaded);
      handleError(error, "재고 제품을 저장하지 못했습니다.");
    } finally { setButtonBusy(inventorySubmit, false); }
  });

  inventoryDelete?.addEventListener("click", async () => {
    const id = formValue(inventoryForm, "id");
    if (!id || !window.confirm("이 제품과 연결된 입출고 기록을 모두 삭제할까요?")) return;
    try {
      await fetchJson(`/api/admin/operations?type=inventory&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      closeInventory();
      await loadInventory();
      showToast("재고 제품을 삭제했습니다.");
    } catch (error) { handleError(error, "재고 제품을 삭제하지 못했습니다."); }
  });

  movementForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!movementForm.reportValidity() || state.preview) return;
    setButtonBusy(movementSubmit, true, "반영 중");
    try {
      const payload = await fetchJson("/api/admin/operations", {
        method: "POST",
        body: JSON.stringify(buildInventoryMovementPayload({
          itemId: formValue(movementForm, "itemId"),
          movementType: formValue(movementForm, "movementType"),
          quantity: formValue(movementForm, "quantity"),
          note: formValue(movementForm, "note")
        }))
      });
      state.inventory.items = state.inventory.items.map((item) => item.id === payload.item?.id ? payload.item : item);
      if (payload.movement) {
        state.inventory.movements = [payload.movement, ...state.inventory.movements.filter((item) => item.id !== payload.movement.id)];
      }
      closeMovement();
      renderInventory();
      showToast("재고 수량과 입출고 원장을 반영했습니다.");
    } catch (error) { handleError(error, "재고 수량을 변경하지 못했습니다."); }
    finally { setButtonBusy(movementSubmit, false); }
  });

  return {
    async activate(moduleName) {
      if (moduleName === "estimate") {
        if (!state.estimate.loaded) await loadEstimates(); else renderEstimates();
      }
      if (moduleName === "production") {
        if (!state.production.loaded) await loadProduction(); else renderProduction();
      }
      if (moduleName === "inventory") {
        if (!state.inventory.loaded) await loadInventory(); else renderInventory();
      }
    },
    async reload(moduleName) {
      if (moduleName === "estimate") await loadEstimates();
      if (moduleName === "production") await loadProduction();
      if (moduleName === "inventory") await loadInventory();
    },
    enablePreview() {
      state.preview = true;
      state.estimate.loaded = false;
      state.production.loaded = false;
      state.inventory.loaded = false;
    },
    reset() {
      state.estimate.entries = [];
      state.estimate.loaded = false;
      state.production.entries = [];
      state.production.loaded = false;
      state.inventory.items = [];
      state.inventory.movements = [];
      state.inventory.loaded = false;
      [estimateDialog, productionDialog, inventoryDialog, movementDialog].forEach((dialog) => { if (dialog?.open) dialog.close(); });
      revokePendingPhoto();
    }
  };
}
