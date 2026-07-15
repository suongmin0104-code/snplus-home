import {
  CalendarCheck2,
  Camera,
  Clock3,
  createIcons,
  Image as ImageIcon,
  MapPin,
  Pencil,
  Users
} from "lucide";

const STATUS_LABELS = Object.freeze({ planned: "예정", progress: "진행 중", completed: "완료" });
const CATEGORY_LABELS = Object.freeze({ field: "현장 작업", delivery: "납품·설치", inspection: "점검·하자", office: "견적·사무", other: "기타" });
const MAX_PHOTOS = 6;
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `work-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function photoUrl(photo) {
  return photo.previewUrl || `/api/admin/worklog-photo?path=${encodeURIComponent(photo.path)}`;
}

function refreshDynamicIcons() {
  createIcons({
    icons: { CalendarCheck2, Camera, Clock3, Image: ImageIcon, MapPin, Pencil, Users },
    attrs: { "aria-hidden": "true", "stroke-width": 2 }
  });
}

function addDays(value, amount) {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function previewEntries() {
  const today = todayKey();
  return [
    {
      id: "preview-field-install",
      title: "디자인난간 현장 설치",
      date: today,
      startTime: "08:30",
      endTime: "16:30",
      status: "progress",
      category: "field",
      site: "화성시 현장",
      workers: "시공팀 3명",
      description: "기초 위치 확인 후 난간 설치와 수평 점검을 진행합니다.",
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "preview-delivery-plan",
      title: "볼라드 납품 일정 확인",
      date: addDays(today, 1),
      startTime: "10:00",
      endTime: "11:00",
      status: "planned",
      category: "delivery",
      site: "부천 납품 현장",
      workers: "영업1팀",
      description: "현장 진입로와 하차 위치를 담당자와 최종 확인합니다.",
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "preview-inspection-done",
      title: "교량난간 설치 상태 점검",
      date: addDays(today, -1),
      startTime: "14:00",
      endTime: "15:30",
      status: "completed",
      category: "inspection",
      site: "김포 교량 현장",
      workers: "백명욱 외 1명",
      description: "체결 상태와 마감 도장을 확인했습니다.",
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

export function setupWorklog({ fetchJson, showToast, onUnauthorized, refreshOverview }) {
  const calendar = document.querySelector("[data-worklog-calendar]");
  const list = document.querySelector("[data-worklog-list]");
  const monthLabel = document.querySelector("[data-worklog-month-label]");
  const selectedLabel = document.querySelector("[data-worklog-selected-label]");
  const dialog = document.querySelector("[data-worklog-dialog]");
  const form = document.querySelector("[data-worklog-form]");
  const photoInput = document.querySelector("[data-worklog-photo-input]");
  const photoGrid = document.querySelector("[data-worklog-photo-grid]");
  const submitButton = document.querySelector("[data-worklog-submit]");
  const deleteButton = document.querySelector("[data-worklog-delete]");

  if (!calendar || !list || !dialog || !form) {
    return { activate() {}, reload() {}, enablePreview() {}, reset() {} };
  }

  const today = parseDate(todayKey());
  const state = {
    entries: [],
    selectedDate: dateKey(today),
    visibleMonth: new Date(today.getFullYear(), today.getMonth(), 1),
    filter: "all",
    loaded: false,
    loading: false,
    preview: false,
    formPhotos: [],
    pendingPhotos: []
  };

  function filteredEntriesForSelectedDate() {
    return state.entries
      .filter((entry) => entry.date === state.selectedDate)
      .filter((entry) => {
        if (state.filter === "completed") return entry.status === "completed";
        if (state.filter === "open") return entry.status !== "completed";
        return true;
      })
      .sort((left, right) => `${left.startTime || "99:99"}${left.title}`.localeCompare(`${right.startTime || "99:99"}${right.title}`, "ko"));
  }

  function updateStats(summary = null) {
    const today = todayKey();
    const calculated = summary || {
      today: state.entries.filter((entry) => entry.date === today).length,
      active: state.entries.filter((entry) => entry.status !== "completed").length,
      overdue: state.entries.filter((entry) => entry.status !== "completed" && entry.date < today).length,
      completed: state.entries.filter((entry) => entry.status === "completed").length
    };

    for (const [key, value] of Object.entries(calculated)) {
      document.querySelectorAll(`[data-worklog-stat="${key}"]`).forEach((element) => {
        element.textContent = `${value}건`;
      });
    }
  }

  function renderCalendar() {
    const year = state.visibleMonth.getFullYear();
    const month = state.visibleMonth.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const today = todayKey();
    const entriesByDate = new Map();

    for (const entry of state.entries) {
      const items = entriesByDate.get(entry.date) || [];
      items.push(entry);
      entriesByDate.set(entry.date, items);
    }

    monthLabel.textContent = `${year}년 ${month + 1}월`;
    calendar.innerHTML = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = dateKey(date);
      const entries = entriesByDate.get(key) || [];
      const classes = ["worklog-calendar-day"];
      if (date.getMonth() !== month) classes.push("is-outside");
      if (key === state.selectedDate) classes.push("is-selected");
      if (key === today) classes.push("is-today");
      const eventMarkup = entries.slice(0, 3).map((entry) => `<span data-status="${entry.status}">${escapeHtml(entry.title)}</span>`).join("");
      const more = entries.length > 3 ? `<small class="worklog-more-count">+${entries.length - 3}</small>` : "";
      const label = `${year}년 ${date.getMonth() + 1}월 ${date.getDate()}일, 일정 ${entries.length}건`;
      return `<button class="${classes.join(" ")}" type="button" data-worklog-date="${key}" role="gridcell" aria-label="${label}"><span class="worklog-day-number">${date.getDate()}</span><span class="worklog-day-events">${eventMarkup}</span>${more}</button>`;
    }).join("");
  }

  function entryMarkup(entry) {
    const time = entry.startTime
      ? `${entry.startTime}${entry.endTime ? ` - ${entry.endTime}` : ""}`
      : "종일";
    const photos = (entry.photos || []).slice(0, 4).map((photo, index) => {
      const url = escapeHtml(photoUrl(photo));
      return `<a href="${url}" target="_blank" rel="noopener" aria-label="${escapeHtml(entry.title)} 사진 ${index + 1}"><img src="${url}" alt="" loading="lazy" decoding="async" /></a>`;
    }).join("");
    const photoCount = entry.photos?.length ? `<span><i data-lucide="image"></i>${entry.photos.length}장</span>` : "";
    const site = entry.site ? `<span><i data-lucide="map-pin"></i>${escapeHtml(entry.site)}</span>` : "";
    const workers = entry.workers ? `<span><i data-lucide="users"></i>${escapeHtml(entry.workers)}</span>` : "";

    return `<article class="worklog-entry-card" data-status="${entry.status}">
      <div><span class="worklog-status" data-status="${entry.status}">${STATUS_LABELS[entry.status] || "예정"}</span><h3>${escapeHtml(entry.title)}</h3></div>
      <button class="icon-button" type="button" data-worklog-edit="${entry.id}" aria-label="일정 수정" title="수정"><i data-lucide="pencil"></i></button>
      <div class="worklog-entry-meta"><span><i data-lucide="clock-3"></i>${time}</span><span>${CATEGORY_LABELS[entry.category] || "기타"}</span>${site}${workers}${photoCount}<button type="button" data-worklog-ics="${entry.id}">캘린더 추가</button></div>
      ${photos ? `<div class="worklog-entry-photos">${photos}</div>` : ""}
    </article>`;
  }

  function renderAgenda() {
    const date = parseDate(state.selectedDate);
    selectedLabel.textContent = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(date);
    const entries = filteredEntriesForSelectedDate();
    list.innerHTML = entries.length
      ? entries.map(entryMarkup).join("")
      : `<div class="worklog-empty"><i data-lucide="calendar-check-2"></i><strong>등록된 일정이 없습니다.</strong><span>선택한 날짜에 현장 작업이나 할 일을 추가하세요.</span></div>`;
    refreshDynamicIcons();
  }

  function render() {
    renderCalendar();
    renderAgenda();
    updateStats();
  }

  function setLoading() {
    list.innerHTML = `<div class="worklog-loading"><span>업무일지를 불러오는 중입니다.</span></div>`;
  }

  async function reload() {
    if (state.loading) return;
    state.loading = true;
    setLoading();

    try {
      if (state.preview) {
        state.entries = previewEntries();
        state.loaded = true;
        render();
        return;
      }
      const payload = await fetchJson("/api/admin/worklog");
      state.entries = Array.isArray(payload.entries) ? payload.entries : [];
      state.loaded = true;
      renderCalendar();
      renderAgenda();
      updateStats(payload.summary);
    } catch (error) {
      if (error.status === 401) onUnauthorized?.();
      list.innerHTML = `<div class="worklog-error"><strong>업무일지를 불러오지 못했습니다.</strong><span>${escapeHtml(error.message || "잠시 후 다시 확인해 주세요.")}</span><button class="secondary-button compact-button" type="button" data-worklog-retry>다시 시도</button></div>`;
    } finally {
      state.loading = false;
    }
  }

  function clearPendingPhotos() {
    for (const photo of state.pendingPhotos) URL.revokeObjectURL(photo.previewUrl);
    state.pendingPhotos = [];
  }

  function renderPhotoGrid() {
    const existing = state.formPhotos.map((photo, index) => `<figure class="worklog-photo-item"><img src="${escapeHtml(photoUrl(photo))}" alt="등록 사진 ${index + 1}" /><button type="button" data-remove-existing-photo="${index}" aria-label="사진 제거"><span aria-hidden="true">×</span></button></figure>`);
    const pending = state.pendingPhotos.map((photo, index) => `<figure class="worklog-photo-item"><img src="${escapeHtml(photo.previewUrl)}" alt="새 사진 ${index + 1}" /><button type="button" data-remove-pending-photo="${index}" aria-label="사진 제거"><span aria-hidden="true">×</span></button></figure>`);
    photoGrid.innerHTML = existing.length || pending.length
      ? [...existing, ...pending].join("")
      : `<div class="worklog-photo-placeholder"><i data-lucide="camera"></i><span>현장사진을 촬영하거나 선택하세요.</span></div>`;
  }

  function fillForm(entry = null) {
    clearPendingPhotos();
    form.reset();
    const values = entry || {
      id: newId(),
      title: "",
      date: state.selectedDate,
      startTime: "",
      endTime: "",
      status: "planned",
      category: "field",
      site: "",
      workers: "",
      description: "",
      photos: []
    };

    for (const [key, value] of Object.entries(values)) {
      const field = form.elements.namedItem(key);
      if (field && typeof value !== "object") field.value = value ?? "";
    }
    state.formPhotos = [...(values.photos || [])];
    dialog.querySelector("[data-worklog-dialog-title]").textContent = entry ? "일정·업무일지 수정" : "새 일정·업무일지";
    deleteButton.hidden = !entry || state.preview;
    renderPhotoGrid();
    refreshDynamicIcons();
  }

  function openForm(entry = null) {
    fillForm(entry);
    dialog.showModal();
    window.setTimeout(() => form.elements.namedItem("title")?.focus(), 50);
  }

  function closeForm() {
    clearPendingPhotos();
    dialog.close();
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("PHOTO_DECODE_FAILED"));
      };
      image.src = url;
    });
  }

  function canvasBlob(canvas, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  }

  async function optimizePhoto(file) {
    const image = await loadImage(file);
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1600 / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let blob = await canvasBlob(canvas, 0.82);
    if (blob?.size > MAX_UPLOAD_BYTES) blob = await canvasBlob(canvas, 0.68);
    if (blob?.size > MAX_UPLOAD_BYTES) blob = await canvasBlob(canvas, 0.54);
    if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error("PHOTO_TOO_LARGE");

    const name = `${file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "현장사진"}.jpg`;
    return { blob, name, previewUrl: URL.createObjectURL(blob) };
  }

  async function uploadPhoto(photo, entryId) {
    const response = await fetch(`/api/admin/worklog-photo?entryId=${encodeURIComponent(entryId)}`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": photo.blob.type || "image/jpeg",
        "X-File-Name": encodeURIComponent(photo.name)
      },
      body: photo.blob
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.message || "사진을 등록하지 못했습니다.");
      error.status = response.status;
      throw error;
    }
    return payload.photo;
  }

  async function deleteUploadedPhotos(photos) {
    await Promise.allSettled(photos.map((photo) => fetch(`/api/admin/worklog-photo?path=${encodeURIComponent(photo.path)}`, {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store"
    })));
  }

  function formPayload() {
    const data = new FormData(form);
    return {
      id: String(data.get("id") || ""),
      title: String(data.get("title") || "").trim(),
      date: String(data.get("date") || ""),
      startTime: String(data.get("startTime") || ""),
      endTime: String(data.get("endTime") || ""),
      status: String(data.get("status") || "planned"),
      category: String(data.get("category") || "field"),
      site: String(data.get("site") || "").trim(),
      workers: String(data.get("workers") || "").trim(),
      description: String(data.get("description") || "").trim(),
      photos: [...state.formPhotos]
    };
  }

  function icsEscape(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }

  function compactDate(value) {
    return String(value).replace(/-/g, "");
  }

  function localIcsDateTime(date) {
    return `${dateKey(date).replace(/-/g, "")}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  }

  function downloadIcs(entry) {
    const startDate = compactDate(entry.date);
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SNPLUS//Field Work Log//KO", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${entry.id}@snplus.ai.kr`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`];
    if (entry.startTime) {
      const start = parseDate(entry.date);
      const [startHour, startMinute] = entry.startTime.split(":").map(Number);
      start.setHours(startHour, startMinute, 0, 0);
      const end = parseDate(entry.date);
      if (entry.endTime) {
        const [endHour, endMinute] = entry.endTime.split(":").map(Number);
        end.setHours(endHour, endMinute, 0, 0);
        if (end <= start) end.setDate(end.getDate() + 1);
      } else {
        end.setTime(start.getTime() + 60 * 60 * 1000);
      }
      lines.push(`DTSTART;TZID=Asia/Seoul:${localIcsDateTime(start)}`, `DTEND;TZID=Asia/Seoul:${localIcsDateTime(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${startDate}`, `DTEND;VALUE=DATE:${compactDate(addDays(entry.date, 1))}`);
    }
    lines.push(`SUMMARY:${icsEscape(entry.title)}`);
    if (entry.site) lines.push(`LOCATION:${icsEscape(entry.site)}`);
    if (entry.description || entry.workers) lines.push(`DESCRIPTION:${icsEscape([entry.description, entry.workers && `참여자: ${entry.workers}`].filter(Boolean).join("\n"))}`);
    lines.push("END:VEVENT", "END:VCALENDAR");

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${entry.date}_${entry.title.replace(/[\\/:*?"<>|]/g, "-")}.ics`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  calendar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-worklog-date]");
    if (!button) return;
    state.selectedDate = button.dataset.worklogDate;
    const selected = parseDate(state.selectedDate);
    if (selected.getMonth() !== state.visibleMonth.getMonth() || selected.getFullYear() !== state.visibleMonth.getFullYear()) {
      state.visibleMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    }
    renderCalendar();
    renderAgenda();
  });

  list.addEventListener("click", (event) => {
    if (event.target.closest("[data-worklog-retry]")) {
      reload();
      return;
    }
    const edit = event.target.closest("[data-worklog-edit]");
    if (edit) {
      openForm(state.entries.find((entry) => entry.id === edit.dataset.worklogEdit) || null);
      return;
    }
    const ics = event.target.closest("[data-worklog-ics]");
    if (ics) {
      const entry = state.entries.find((item) => item.id === ics.dataset.worklogIcs);
      if (entry) downloadIcs(entry);
    }
  });

  document.querySelectorAll("[data-worklog-month]").forEach((button) => {
    button.addEventListener("click", () => {
      state.visibleMonth = new Date(state.visibleMonth.getFullYear(), state.visibleMonth.getMonth() + (button.dataset.worklogMonth === "next" ? 1 : -1), 1);
      renderCalendar();
    });
  });

  document.querySelector("[data-worklog-today]")?.addEventListener("click", () => {
    state.selectedDate = todayKey();
    const now = parseDate(state.selectedDate);
    state.visibleMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    render();
  });

  document.querySelectorAll("[data-worklog-new]").forEach((button) => button.addEventListener("click", () => openForm()));
  document.querySelectorAll("[data-worklog-close]").forEach((button) => button.addEventListener("click", closeForm));

  document.querySelectorAll("[data-worklog-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.worklogFilter;
      document.querySelectorAll("[data-worklog-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderAgenda();
    });
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeForm();
  });

  photoGrid.addEventListener("click", (event) => {
    const existing = event.target.closest("[data-remove-existing-photo]");
    if (existing) {
      state.formPhotos.splice(Number(existing.dataset.removeExistingPhoto), 1);
      renderPhotoGrid();
      return;
    }
    const pending = event.target.closest("[data-remove-pending-photo]");
    if (pending) {
      const [removed] = state.pendingPhotos.splice(Number(pending.dataset.removePendingPhoto), 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      renderPhotoGrid();
    }
  });

  photoInput.addEventListener("change", async () => {
    const remaining = MAX_PHOTOS - state.formPhotos.length - state.pendingPhotos.length;
    const files = Array.from(photoInput.files || []).slice(0, Math.max(0, remaining));
    photoInput.value = "";
    if (!files.length) {
      showToast(remaining <= 0 ? "현장사진은 최대 6장까지 등록할 수 있습니다." : "사진을 선택하지 않았습니다.");
      return;
    }

    try {
      for (const file of files) {
        state.pendingPhotos.push(await optimizePhoto(file));
      }
      renderPhotoGrid();
      showToast(`${files.length}장의 사진을 준비했습니다.`);
    } catch {
      showToast("이 사진은 처리하지 못했습니다. JPEG 사진으로 다시 선택해 주세요.");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (state.preview) {
      showToast("미리보기에서는 저장하지 않습니다.");
      return;
    }

    const payload = formPayload();
    const uploaded = [];
    submitButton.disabled = true;
    submitButton.querySelector("span").textContent = state.pendingPhotos.length ? "사진 저장 중" : "저장 중";
    try {
      for (const photo of state.pendingPhotos) {
        uploaded.push(await uploadPhoto(photo, payload.id));
      }
      payload.photos.push(...uploaded);
      await fetchJson("/api/admin/worklog", { method: "POST", body: JSON.stringify(payload) });
      clearPendingPhotos();
      dialog.close();
      await reload();
      await refreshOverview?.();
      showToast("일정과 현장 업무일지를 저장했습니다.");
    } catch (error) {
      if (uploaded.length) await deleteUploadedPhotos(uploaded);
      if (error.status === 401) onUnauthorized?.();
      showToast(error.message || "업무일지를 저장하지 못했습니다.");
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector("span").textContent = "저장";
    }
  });

  deleteButton.addEventListener("click", async () => {
    const id = String(form.elements.namedItem("id")?.value || "");
    if (!id || !window.confirm("이 일정과 연결된 현장사진을 모두 삭제할까요?")) return;
    deleteButton.disabled = true;
    try {
      await fetchJson(`/api/admin/worklog?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      closeForm();
      await reload();
      await refreshOverview?.();
      showToast("업무일지를 삭제했습니다.");
    } catch (error) {
      if (error.status === 401) onUnauthorized?.();
      showToast(error.message || "업무일지를 삭제하지 못했습니다.");
    } finally {
      deleteButton.disabled = false;
    }
  });

  return {
    async activate() {
      if (!state.loaded) await reload();
      else render();
    },
    reload,
    enablePreview() {
      state.preview = true;
      state.loaded = false;
    },
    reset() {
      state.entries = [];
      state.loaded = false;
      clearPendingPhotos();
      if (dialog.open) dialog.close();
    }
  };
}
