const DRAFT_STORAGE_KEY = "sn-admin-document-drafts-v1";
const INITIAL_ITEM_COUNT = 12;

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

function defaultDocument(type) {
  const meta = documentMeta[type] ?? documentMeta.estimate;
  const date = localDateString();
  return {
    type,
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

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value || 0);
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

export function setupDocumentEditor({ showModule, showToast }) {
  const form = document.querySelector("[data-document-form]");
  if (!form) return { open() {} };

  const itemBody = form.querySelector("[data-document-items]");
  const saveStatus = document.querySelector("[data-doc-save-status]");
  let currentType = "estimate";
  let saveTimer = null;

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
    return { type: currentType, ...values, items: collectItems() };
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
    let lineTotal = 0;
    itemBody.querySelectorAll("[data-item-row]").forEach((row) => {
      const quantity = parseNumber(row.querySelector('[data-item-field="quantity"]')?.value);
      const unitPrice = parseNumber(row.querySelector('[data-item-field="unitPrice"]')?.value);
      const amount = Math.round(quantity * unitPrice);
      lineTotal += amount;
      row.querySelector("[data-item-amount]").textContent = amount ? formatNumber(amount) : "-";
    });

    const vatMode = form.querySelector('[data-doc-field="vatMode"]')?.value ?? "separate";
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

    form.querySelector("[data-doc-subtotal]").textContent = `${formatNumber(supply)}원`;
    form.querySelector("[data-doc-vat]").textContent = `${formatNumber(vat)}원`;
    form.querySelector("[data-doc-total]").textContent = `${formatNumber(total)}원`;
    form.querySelector("[data-doc-amount-words]").textContent = `금 ${koreanNumber(total)}원정`;
    form.querySelector("[data-doc-amount-number]").textContent = `₩ ${formatNumber(total)}`;
  }

  function applyDocument(data) {
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

  function setType(type, { useDraft = true } = {}) {
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

    const draft = useDraft ? readDrafts()[currentType] : null;
    applyDocument(draft ? { ...defaultDocument(currentType), ...draft } : defaultDocument(currentType));
    if (saveStatus) saveStatus.textContent = draft ? "저장된 임시 문서를 불러왔습니다." : "새 문서 · 입력하면 자동 임시저장됩니다.";
  }

  function open(type = "estimate") {
    setType(type);
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

  document.querySelector("[data-doc-save]")?.addEventListener("click", () => saveDraft({ notify: true }));

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

  document.querySelector("[data-doc-print]")?.addEventListener("click", () => {
    document.activeElement?.blur();
    form.querySelectorAll('[data-item-field="unitPrice"]').forEach((input) => {
      if (input.value.trim()) input.value = formatNumber(parseNumber(input.value));
    });
    calculate();
    saveDraft();
    const data = collectDocument();
    const name = [documentMeta[currentType].title, data.client || data.project || data.date].filter(Boolean).join("_");
    document.body.dataset.printDocument = "true";
    document.title = name.replace(/[\\/:*?"<>|]/g, "-");
    window.requestAnimationFrame(() => window.print());
  });

  window.addEventListener("afterprint", () => {
    delete document.body.dataset.printDocument;
    document.title = "SN 업무포털 | 주식회사 에스앤";
  });

  Object.entries(company).forEach(([key, value]) => {
    document.querySelectorAll(`[data-doc-company="${key}"]`).forEach((element) => {
      element.textContent = value;
    });
  });

  setType("estimate");
  return { open, setType };
}
