const DRAFT_STORAGE_KEY = "sn-admin-document-drafts-v1";
const INITIAL_ITEM_COUNT = 12;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

const company = Object.freeze({
  name: "주식회사 에스앤",
  headOffice: "경기도 화성시 마도면 청원로231번길 4",
  branch: "경기도 부천시 양지로 205 서영아너시티2 1004호",
  phone: "031-852-2918",
  fax: "031-852-2919",
  email: "sn6221@naver.com"
});

const documentMeta = Object.freeze({
  estimate: {
    title: "견적서",
    dateLabel: "견적일",
    managerName: "박정민",
    managerTitle: "부장",
    managerPhone: "010-9089-7877",
    notes: ["부가세 별도, 현장 설치도", "현금 결제조건, 당사 결제조건", "수량 변동 시 별도 정산"]
  },
  transaction: {
    title: "거래명세서",
    dateLabel: "납품일",
    managerName: "박정환",
    managerTitle: "이사",
    managerPhone: "010-4888-1504",
    notes: ["거래 및 납품 내역을 확인해 주시기 바랍니다."]
  }
});

function localDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function newOperationId(prefix = "estimate") {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultDocument(type) {
  const meta = documentMeta[type] ?? documentMeta.estimate;
  const date = localDateString();
  return {
    type,
    estimateId: type === "estimate" ? newOperationId() : "",
    date,
    client: "",
    project: "",
    documentNumber: `SN-${date.replaceAll("-", "")}-001`,
    vatMode: "separate",
    managerName: meta.managerName,
    managerTitle: meta.managerTitle,
    managerPhone: meta.managerPhone,
    notes: meta.notes.join("\n"),
    items: Array.from({ length: INITIAL_ITEM_COUNT }, () => ({
      item: "",
      specification: "",
      unit: "",
      quantity: "",
      unitPrice: "",
      note: ""
    }))
  };
}

function readDrafts() {
  try {
    return JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) || "{}") ?? {};
  } catch {
    return {};
  }
}

function parseNumber(value) {
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateDocumentTotals(items = [], vatMode = "separate") {
  const lineTotal = (Array.isArray(items) ? items : []).reduce((sum, item) => {
    return sum + Math.round(parseNumber(item?.quantity) * parseNumber(item?.unitPrice));
  }, 0);
  let supply = lineTotal;
  let vat = 0;
  let total = lineTotal;
  if (vatMode === "separate") {
    vat = Math.round(supply * 0.1);
    total = supply + vat;
  } else if (vatMode === "included") {
    supply = Math.round(lineTotal / 1.1);
    vat = lineTotal - supply;
  }
  return { supply, vat, total };
}

export function buildEstimateOperationPayload(data = {}) {
  const items = Array.isArray(data.items) ? data.items : [];
  const totals = calculateDocumentTotals(items, data.vatMode);
  const client = String(data.client ?? "").trim();
  const project = String(data.project ?? "").trim();
  const documentNumber = String(data.documentNumber ?? "").trim();
  const estimateId = OPERATION_ID_PATTERN.test(String(data.estimateId ?? ""))
    ? String(data.estimateId)
    : newOperationId();
  const meaningfulItems = items.filter((item) => Object.values(item || {}).some((value) => String(value ?? "").trim()));

  return {
    type: "estimate",
    id: estimateId,
    title: project || (client ? `${client} 견적` : `견적서 ${documentNumber || data.date || ""}`.trim()),
    date: String(data.date ?? "").trim(),
    clientName: client,
    contactName: String(data.managerName ?? "").trim(),
    contactPhone: String(data.managerPhone ?? "").trim(),
    documentNumber,
    supplyAmount: totals.supply,
    vatAmount: totals.vat,
    totalAmount: totals.total,
    itemCount: meaningfulItems.length,
    source: "document-editor",
    document: {
      ...data,
      type: "estimate",
      estimateId,
      items
    }
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value || 0);
}

function sanitizeFilename(value) {
  const cleaned = String(value || "SN_문서")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "SN_문서").slice(0, 120);
}

function waitForPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function replaceFormFieldsForPdf(clonedDocument) {
  clonedDocument
    .querySelectorAll(".document-sheet input, .document-sheet select, .document-sheet textarea")
    .forEach((field) => {
      if (field.closest(".no-print")) return;
      const output = clonedDocument.createElement(field.tagName === "TEXTAREA" ? "div" : "span");
      output.dataset.pdfValue = "";
      output.className = field.className;
      output.textContent = field.tagName === "SELECT"
        ? field.options[field.selectedIndex]?.textContent || ""
        : field.value || "";
      field.replaceWith(output);
    });
}

async function renderDocumentCanvas(sheet) {
  const { default: html2canvas } = await import("html2canvas");
  document.body.dataset.exportDocument = "true";
  try {
    await document.fonts?.ready;
    await waitForPaint();
    return html2canvas(sheet, {
      backgroundColor: "#ffffff",
      logging: false,
      onclone: replaceFormFieldsForPdf,
      scale: 2,
      useCORS: true,
      windowWidth: sheet.scrollWidth,
      windowHeight: sheet.scrollHeight
    });
  } finally {
    delete document.body.dataset.exportDocument;
  }
}

function createPngBlob(sheet) {
  return renderDocumentCanvas(sheet).then((canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG clipboard image could not be created."));
    }, "image/png");
  }));
}

async function createPdfFile(sheet, filename) {
  const [canvas, { jsPDF }] = await Promise.all([
    renderDocumentCanvas(sheet),
    import("jspdf")
  ]);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = 210;
  const pageHeight = 297;
  const imageHeight = (canvas.height * pageWidth) / canvas.width;
  const image = canvas.toDataURL("image/jpeg", 0.96);
  let offset = 0;

  pdf.addImage(image, "JPEG", 0, offset, pageWidth, imageHeight, undefined, "FAST");
  for (let remaining = imageHeight - pageHeight; remaining > 0.5; remaining -= pageHeight) {
    offset -= pageHeight;
    pdf.addPage();
    pdf.addImage(image, "JPEG", 0, offset, pageWidth, imageHeight, undefined, "FAST");
  }

  const blob = pdf.output("blob");
  return new File([blob], `${sanitizeFilename(filename)}.pdf`, {
    type: "application/pdf",
    lastModified: Date.now()
  });
}

function koreanNumber(value) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  if (!amount) return "영";

  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const smallUnits = ["", "십", "백", "천"];
  const largeUnits = ["", "만", "억", "조", "경"];
  let remaining = amount;
  let groupIndex = 0;
  const groups = [];

  while (remaining > 0 && groupIndex < largeUnits.length) {
    const group = remaining % 10000;
    if (group) {
      let groupText = "";
      let part = group;
      for (let index = 0; index < 4; index += 1) {
        const digit = part % 10;
        if (digit) {
          const digitText = digit === 1 && index > 0 ? "" : digits[digit];
          groupText = `${digitText}${smallUnits[index]}${groupText}`;
        }
        part = Math.floor(part / 10);
      }
      groups.unshift(`${groupText}${largeUnits[groupIndex]}`);
    }
    remaining = Math.floor(remaining / 10000);
    groupIndex += 1;
  }

  return groups.join("");
}

function makeInput(className, field, rowIndex, label, options = {}) {
  const input = document.createElement("input");
  input.className = className;
  input.type = options.type ?? "text";
  input.inputMode = options.inputMode ?? "text";
  input.autocomplete = "off";
  input.dataset.itemField = field;
  input.dataset.rowIndex = String(rowIndex);
  input.setAttribute("aria-label", `${rowIndex + 1}번 ${label}`);
  if (options.placeholder) input.placeholder = options.placeholder;
  return input;
}

export function setupDocumentEditor({ fetchJson, showModule, showToast, onEstimateSaved, onUnauthorized }) {
  const form = document.querySelector("[data-document-form]");
  if (!form) return { open() {} };

  const itemBody = form.querySelector("[data-document-items]");
  const saveStatus = document.querySelector("[data-doc-save-status]");
  const saveButton = document.querySelector("[data-doc-save]");
  let currentType = "estimate";
  let currentEstimateId = "";
  let saveTimer = null;
  const downloadButton = document.querySelector("[data-doc-download]");
  const shareButton = document.querySelector("[data-doc-share]");
  const isMobileDevice = navigator.userAgentData?.mobile
    ?? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const canCopyForKakao = !isMobileDevice
    && window.isSecureContext
    && typeof ClipboardItem === "function"
    && typeof navigator.clipboard?.write === "function"
    && (typeof ClipboardItem.supports !== "function" || ClipboardItem.supports("image/png"));

  if (canCopyForKakao && shareButton) {
    const label = shareButton.querySelector("span");
    if (label) label.textContent = "카톡에 붙여넣기";
    shareButton.title = "문서를 복사한 뒤 카카오톡 채팅창에서 Ctrl+V를 누르세요.";
  }

  function setField(name, value) {
    const field = form.querySelector(`[data-doc-field="${name}"]`);
    if (field) field.value = value ?? "";
  }

  function appendItemRow(item = {}, rowIndex = itemBody.children.length) {
    const row = document.createElement("tr");
    row.dataset.itemRow = "";

    const numberCell = document.createElement("td");
    numberCell.className = "doc-row-number";
    numberCell.textContent = String(rowIndex + 1);
    row.append(numberCell);

    const fields = [
      ["item", "doc-item-name", "품명", { placeholder: "품명" }],
      ["specification", "doc-item-spec", "규격", { placeholder: "규격" }],
      ["unit", "doc-item-unit", "단위", { placeholder: "EA" }],
      ["quantity", "doc-item-quantity", "수량", { inputMode: "decimal", placeholder: "0" }],
      ["unitPrice", "doc-item-price", "단가", { inputMode: "numeric", placeholder: "0" }]
    ];

    fields.forEach(([field, className, label, options]) => {
      const cell = document.createElement("td");
      const input = makeInput(className, field, rowIndex, label, options);
      input.value = item[field] ?? "";
      cell.append(input);
      row.append(cell);
    });

    const amountCell = document.createElement("td");
    amountCell.className = "doc-item-amount";
    const amountOutput = document.createElement("output");
    amountOutput.dataset.itemAmount = "";
    amountOutput.textContent = "0";
    amountCell.append(amountOutput);
    row.append(amountCell);

    const noteCell = document.createElement("td");
    const noteInput = makeInput("doc-item-note", "note", rowIndex, "비고", { placeholder: "비고" });
    noteInput.value = item.note ?? "";
    noteCell.append(noteInput);
    row.append(noteCell);

    const actionCell = document.createElement("td");
    actionCell.className = "doc-row-action no-print";
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.dataset.removeItem = "";
    removeButton.title = "행 삭제";
    removeButton.setAttribute("aria-label", `${rowIndex + 1}번 행 삭제`);
    removeButton.textContent = "×";
    actionCell.append(removeButton);
    row.append(actionCell);

    itemBody.append(row);
  }

  function renumberRows() {
    itemBody.querySelectorAll("[data-item-row]").forEach((row, index) => {
      row.querySelector(".doc-row-number").textContent = String(index + 1);
      row.querySelectorAll("[data-item-field]").forEach((input) => {
        input.dataset.rowIndex = String(index);
      });
      row.querySelector("[data-remove-item]")?.setAttribute("aria-label", `${index + 1}번 행 삭제`);
    });
  }

  function collectItems() {
    return [...itemBody.querySelectorAll("[data-item-row]")].map((row) => {
      const item = {};
      row.querySelectorAll("[data-item-field]").forEach((input) => {
        item[input.dataset.itemField] = input.value;
      });
      return item;
    });
  }

  function collectDocument() {
    const values = {};
    form.querySelectorAll("[data-doc-field]").forEach((field) => {
      values[field.dataset.docField] = field.value;
    });
    return {
      type: currentType,
      ...(currentType === "estimate" ? { estimateId: currentEstimateId || newOperationId() } : {}),
      ...values,
      items: collectItems()
    };
  }

  function saveDraft({ notify = false } = {}) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
    const drafts = readDrafts();
    drafts[currentType] = collectDocument();
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    if (saveStatus) saveStatus.textContent = `이 브라우저에 임시저장됨 · ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
    if (notify) showToast("작성 중인 문서를 이 브라우저에 임시저장했습니다.");
  }

  function queueSave() {
    if (saveStatus) saveStatus.textContent = "변경 내용 저장 중";
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveDraft(), 450);
  }

  function calculate() {
    itemBody.querySelectorAll("[data-item-row]").forEach((row) => {
      const quantity = parseNumber(row.querySelector('[data-item-field="quantity"]')?.value);
      const unitPrice = parseNumber(row.querySelector('[data-item-field="unitPrice"]')?.value);
      const amount = Math.round(quantity * unitPrice);
      row.querySelector("[data-item-amount]").textContent = amount ? formatNumber(amount) : "-";
    });

    const vatMode = form.querySelector('[data-doc-field="vatMode"]')?.value ?? "separate";
    const { supply, vat, total } = calculateDocumentTotals(collectItems(), vatMode);

    form.querySelector("[data-doc-subtotal]").textContent = `${formatNumber(supply)}원`;
    form.querySelector("[data-doc-vat]").textContent = `${formatNumber(vat)}원`;
    form.querySelector("[data-doc-total]").textContent = `${formatNumber(total)}원`;
    form.querySelector("[data-doc-amount-words]").textContent = `금 ${koreanNumber(total)}원정`;
    form.querySelector("[data-doc-amount-number]").textContent = `₩ ${formatNumber(total)}`;
    return { supply, vat, total };
  }

  function updateSaveButtonLabel(busy = false) {
    if (!saveButton) return;
    const label = saveButton.querySelector("span");
    if (label) label.textContent = busy ? "PDF 원본 저장 중" : (currentType === "estimate" ? "견적서 저장" : "임시저장");
    saveButton.disabled = busy;
    saveButton.setAttribute("aria-busy", busy ? "true" : "false");
  }

  async function uploadEstimatePdf(file, estimateId) {
    const response = await fetch(`/api/admin/operations?type=estimate-pdf&id=${encodeURIComponent(estimateId)}`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/pdf",
        "X-File-Name": encodeURIComponent(file.name)
      },
      body: file
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : {};
    if (!response.ok) {
      const error = new Error(payload.message || "견적서 PDF 원본을 저장하지 못했습니다.");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function saveEstimateToManagement({ notify = true, prepared = null, pdfFile = null } = {}) {
    if (currentType !== "estimate") {
      saveDraft({ notify });
      return null;
    }

    const preparedDocument = prepared || prepareCurrentDocument();
    const data = preparedDocument.data;
    if (!data.client.trim() && !data.project.trim()) {
      form.querySelector('[data-doc-field="client"]')?.focus();
      throw new Error("거래처 또는 공사명을 입력해 주세요.");
    }
    const file = pdfFile || await createPdfFile(form, preparedDocument.name);
    const payload = buildEstimateOperationPayload(data);
    const result = await fetchJson("/api/admin/operations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    currentEstimateId = result.entry?.id || payload.id;
    const uploaded = await uploadEstimatePdf(file, currentEstimateId);
    saveDraft();
    const savedAt = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    if (saveStatus) saveStatus.textContent = `견적관리 달력에 저장됨 · PDF 원본 포함 · ${savedAt}`;
    try {
      await onEstimateSaved?.(uploaded.entry || result.entry);
    } catch (error) {
      console.warn("Estimate list refresh failed after save", error);
    }
    if (notify) showToast("견적서와 PDF 원본을 견적관리 달력에 저장했습니다.");
    return { entry: uploaded.entry || result.entry, file };
  }

  function handleEstimateSaveError(error) {
    if ([401, 403].includes(error?.status)) onUnauthorized?.(error);
    showToast(error?.message || "견적서를 견적관리에 저장하지 못했습니다.");
  }

  async function saveEstimateBeforeOutput(options = {}) {
    try {
      return await saveEstimateToManagement({ notify: false, ...options });
    } catch (error) {
      if (error && typeof error === "object") error.isEstimateSaveError = true;
      throw error;
    }
  }

  function setPdfActionsBusy(activeButton, busy, busyLabel = "PDF 생성 중") {
    [downloadButton, shareButton].forEach((button) => {
      if (!button) return;
      const label = button.querySelector("span");
      if (label && !button.dataset.idleLabel) button.dataset.idleLabel = label.textContent;
      button.disabled = busy;
      button.setAttribute("aria-busy", busy ? "true" : "false");
      if (label) label.textContent = busy && button === activeButton ? busyLabel : button.dataset.idleLabel;
    });
  }

  function prepareCurrentDocument() {
    document.activeElement?.blur();
    form.querySelectorAll('[data-item-field="unitPrice"]').forEach((input) => {
      if (input.value.trim()) input.value = formatNumber(parseNumber(input.value));
    });
    calculate();
    saveDraft();
    const data = collectDocument();
    const name = [documentMeta[currentType].title, data.client || data.project || data.date]
      .filter(Boolean)
      .join("_");
    return { data, name };
  }

  async function makeCurrentPdf() {
    const prepared = prepareCurrentDocument();
    const file = await createPdfFile(form, prepared.name);
    if (currentType === "estimate") await saveEstimateBeforeOutput({ prepared, pdfFile: file });
    return file;
  }

  async function copyCurrentDocumentForKakao() {
    const prepared = prepareCurrentDocument();
    if (currentType === "estimate") {
      const pdfFile = await createPdfFile(form, prepared.name);
      await saveEstimateBeforeOutput({ prepared, pdfFile });
    }
    const imagePromise = createPngBlob(form);
    return navigator.clipboard.write([
      new ClipboardItem({ "image/png": imagePromise }, { presentationStyle: "attachment" })
    ]);
  }

  function applyDocument(data) {
    currentEstimateId = currentType === "estimate" && OPERATION_ID_PATTERN.test(String(data.estimateId ?? ""))
      ? String(data.estimateId)
      : (currentType === "estimate" ? newOperationId() : "");
    setField("date", data.date);
    setField("client", data.client);
    setField("project", data.project);
    setField("documentNumber", data.documentNumber);
    setField("vatMode", data.vatMode || "separate");
    setField("managerName", data.managerName);
    setField("managerTitle", data.managerTitle);
    setField("managerPhone", data.managerPhone);
    setField("notes", data.notes);

    itemBody.replaceChildren();
    const items = Array.isArray(data.items) && data.items.length ? data.items : defaultDocument(currentType).items;
    items.forEach((item, index) => appendItemRow(item, index));
    renumberRows();
    calculate();
  }

  function setType(type, { useDraft = true, documentData = null } = {}) {
    const nextType = documentMeta[type] ? type : "estimate";
    if (saveTimer) saveDraft();
    currentType = nextType;
    const meta = documentMeta[currentType];
    form.dataset.documentType = currentType;
    document.querySelectorAll("[data-doc-type-label]").forEach((element) => {
      element.textContent = meta.title;
    });
    document.querySelectorAll("[data-doc-date-label]").forEach((element) => {
      element.textContent = meta.dateLabel;
    });
    document.querySelectorAll("[data-doc-type-button]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.docTypeButton === currentType);
      button.setAttribute("aria-pressed", button.dataset.docTypeButton === currentType ? "true" : "false");
    });
    updateSaveButtonLabel();

    const draft = useDraft ? readDrafts()[currentType] : null;
    const source = documentData || draft;
    applyDocument(source ? { ...defaultDocument(currentType), ...source } : defaultDocument(currentType));
    if (saveStatus) {
      saveStatus.textContent = documentData
        ? "견적관리에서 저장된 견적서를 불러왔습니다."
        : (draft ? "저장된 임시 문서를 불러왔습니다." : "새 문서 · 입력하면 자동 임시저장됩니다.");
    }
  }

  function open(type = "estimate", documentData = null) {
    setType(type, { useDraft: !documentData, documentData });
    showModule("document-editor");
    window.setTimeout(() => form.querySelector('[data-doc-field="client"]')?.focus(), 120);
  }

  form.addEventListener("input", (event) => {
    if (event.target.matches('[data-item-field="quantity"], [data-item-field="unitPrice"], [data-doc-field="vatMode"]')) calculate();
    queueSave();
  });

  form.addEventListener("change", () => {
    calculate();
    queueSave();
  });

  form.addEventListener("focusout", (event) => {
    if (event.target.matches('[data-item-field="unitPrice"]') && event.target.value.trim()) {
      event.target.value = formatNumber(parseNumber(event.target.value));
    }
  });

  itemBody.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-item]");
    if (!removeButton) return;
    if (itemBody.children.length <= 1) {
      showToast("품목 행은 한 줄 이상 필요합니다.");
      return;
    }
    removeButton.closest("tr")?.remove();
    renumberRows();
    calculate();
    queueSave();
  });

  document.querySelectorAll("[data-doc-type-button]").forEach((button) => {
    button.addEventListener("click", () => setType(button.dataset.docTypeButton));
  });

  document.querySelector("[data-doc-add-row]")?.addEventListener("click", () => {
    appendItemRow();
    renumberRows();
    calculate();
    queueSave();
    itemBody.lastElementChild?.querySelector('[data-item-field="item"]')?.focus();
  });

  saveButton?.addEventListener("click", async () => {
    if (currentType !== "estimate") {
      saveDraft({ notify: true });
      return;
    }
    updateSaveButtonLabel(true);
    try {
      await saveEstimateToManagement();
    } catch (error) {
      handleEstimateSaveError(error);
    } finally {
      updateSaveButtonLabel(false);
    }
  });

  document.querySelector("[data-doc-reset]")?.addEventListener("click", () => {
    if (!window.confirm("현재 작성 내용을 비우고 새 문서를 시작할까요?")) return;
    window.clearTimeout(saveTimer);
    saveTimer = null;
    const drafts = readDrafts();
    delete drafts[currentType];
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    setType(currentType, { useDraft: false });
    showToast("새 문서를 준비했습니다.");
  });

  downloadButton?.addEventListener("click", async () => {
    setPdfActionsBusy(downloadButton, true);
    try {
      const file = await makeCurrentPdf();
      downloadFile(file);
      showToast(`${file.name} 파일을 저장했습니다.`);
    } catch (error) {
      console.error("PDF download failed", error);
      if (error?.isEstimateSaveError) handleEstimateSaveError(error);
      else showToast("PDF 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPdfActionsBusy(downloadButton, false);
    }
  });

  shareButton?.addEventListener("click", async () => {
    setPdfActionsBusy(shareButton, true, canCopyForKakao ? "문서 복사 중" : "공유 파일 생성 중");
    try {
      if (canCopyForKakao) {
        await copyCurrentDocumentForKakao();
        if (saveStatus) saveStatus.textContent = "카톡용 문서 복사 완료 · 카카오톡 채팅창에서 Ctrl+V를 누르세요.";
        showToast("문서를 복사했습니다. 카카오톡 채팅창에서 Ctrl+V를 누르세요.");
        return;
      }

      const file = await makeCurrentPdf();
      const shareData = {
        files: [file],
        title: file.name.replace(/\.pdf$/i, ""),
        text: `${documentMeta[currentType].title} PDF 파일입니다.`
      };
      const canShareFile = typeof navigator.share === "function"
        && (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));

      if (!canShareFile) {
        downloadFile(file);
        showToast("PDF를 저장했습니다. 카카오톡 채팅방에서 파일 첨부로 보내 주세요.");
        return;
      }

      try {
        await navigator.share(shareData);
        showToast("공유를 완료했습니다.");
      } catch (error) {
        if (error?.name === "AbortError") return;
        downloadFile(file);
        showToast("공유창을 열 수 없어 PDF를 저장했습니다. 카카오톡에서 첨부해 주세요.");
      }
    } catch (error) {
      console.error("PDF share failed", error);
      if (error?.isEstimateSaveError) handleEstimateSaveError(error);
      else showToast("공유할 PDF 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPdfActionsBusy(shareButton, false);
    }
  });

  Object.entries(company).forEach(([key, value]) => {
    document.querySelectorAll(`[data-doc-company="${key}"]`).forEach((element) => {
      element.textContent = value;
    });
  });

  setType("estimate");
  return { open, setType };
}
