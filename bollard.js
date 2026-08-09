const CONTACT_ENDPOINT = "/api/contact";
const MAX_PHOTOS = 2;
const MAX_SOURCE_PHOTO_BYTES = 12 * 1024 * 1024;
const TARGET_PHOTO_BYTES = 650 * 1024;
const CONTACT_COOLDOWN_MS = 5000;
const ATTRIBUTION_KEY = "snplus_attribution_v1";
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

let isSubmitting = false;
let lastSubmitAt = 0;
let formStarted = false;

function injectVercelAnalytics() {
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };
  if (!document.querySelector('script[src="/_vercel/insights/script.js"]')) {
    const script = document.createElement("script");
    script.src = "/_vercel/insights/script.js";
    script.defer = true;
    document.head.appendChild(script);
  }
}

function safeStorageGet(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || "null"); }
  catch { return null; }
}

function captureAttribution() {
  const params = new URLSearchParams(location.search);
  const previous = safeStorageGet(ATTRIBUTION_KEY) || {};
  const hasCampaign = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].some((key) => params.has(key));
  const current = {
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmTerm: params.get("utm_term") || "",
    utmContent: params.get("utm_content") || "",
    referrer: document.referrer || previous.referrer || "",
    landingPage: previous.landingPage || location.href,
    firstSeenAt: previous.firstSeenAt || new Date().toISOString()
  };
  const attribution = hasCampaign ? { ...previous, ...current, landingPage: location.href } : { ...current, ...previous };
  try { sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution)); }
  catch { /* The form still works when storage is unavailable. */ }
  return attribution;
}

function getSourceLabel(attribution) {
  if (attribution.utmSource) return attribution.utmSource.slice(0, 80);
  if (!attribution.referrer) return "direct";
  try { return new URL(attribution.referrer).hostname.slice(0, 80) || "referral"; }
  catch { return "referral"; }
}

function trackEvent(name, placement = "bollard") {
  const attribution = captureAttribution();
  window.va?.("event", { name, data: { placement: String(placement).slice(0, 80), source: getSourceLabel(attribution) } });
}

function setStatus(type, message) {
  const status = document.querySelector("[data-status]");
  if (!status) return;
  status.className = `form-status ${type || ""}`.trim();
  status.textContent = message;
  status.setAttribute("role", type === "error" ? "alert" : "status");
}

function valueOf(form, name) { return form.elements[name]?.value?.trim() || ""; }
function validPhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 12 && /^[0-9+\-().\s]+$/.test(value);
}
function validEmail(value) { return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

function validateForm(form) {
  const required = [
    ["companyName", "회사명 또는 현장명을 입력해 주세요."],
    ["contactName", "담당자명을 입력해 주세요."],
    ["phone", "연락처를 입력해 주세요."],
    ["region", "설치 지역을 입력해 주세요."],
    ["requestKind", "요청 구분을 선택해 주세요."]
  ];
  for (const [name, message] of required) {
    if (!valueOf(form, name)) {
      setStatus("error", message);
      form.elements[name]?.focus();
      return false;
    }
  }
  if (!validPhone(valueOf(form, "phone"))) {
    setStatus("error", "연락처 형식을 확인해 주세요.");
    form.elements.phone?.focus();
    return false;
  }
  if (!validEmail(valueOf(form, "email"))) {
    setStatus("error", "이메일 형식을 확인해 주세요.");
    form.elements.email?.focus();
    return false;
  }
  if (!form.elements.privacyConsent?.checked) {
    setStatus("error", "개인정보 수집 및 이용에 동의해 주세요.");
    form.elements.privacyConsent?.focus();
    return false;
  }
  const files = Array.from(form.elements.photos?.files || []);
  if (files.length > MAX_PHOTOS) {
    setStatus("error", `현장사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
    form.elements.photos?.focus();
    return false;
  }
  for (const file of files) {
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setStatus("error", "현장사진은 JPG, PNG, WEBP 형식만 첨부할 수 있습니다.");
      return false;
    }
    if (file.size > MAX_SOURCE_PHOTO_BYTES) {
      setStatus("error", "원본 사진은 한 장당 12MB 이하로 선택해 주세요.");
      return false;
    }
  }
  return true;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("PHOTO_READ_FAILED"));
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.readAsDataURL(blob);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("PHOTO_DECODE_FAILED"));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PHOTO_COMPRESS_FAILED")), "image/jpeg", quality);
  });
}

async function compressPhoto(file, index) {
  const { image, objectUrl } = await loadImage(file);
  try {
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    let scale = Math.min(1, 1600 / Math.max(longest, 1));
    let lastBlob = null;
    for (let sizePass = 0; sizePass < 4; sizePass += 1) {
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("PHOTO_CANVAS_FAILED");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      for (const quality of [0.84, 0.74, 0.64, 0.55]) {
        lastBlob = await canvasToBlob(canvas, quality);
        if (lastBlob.size <= TARGET_PHOTO_BYTES) {
          return {
            name: `snplus-site-photo-${index + 1}.jpg`,
            contentType: "image/jpeg",
            size: lastBlob.size,
            content: await blobToBase64(lastBlob)
          };
        }
      }
      scale *= 0.78;
    }
    if (!lastBlob) throw new Error("PHOTO_COMPRESS_FAILED");
    return {
      name: `snplus-site-photo-${index + 1}.jpg`,
      contentType: "image/jpeg",
      size: lastBlob.size,
      content: await blobToBase64(lastBlob)
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function preparePhotos(files) {
  const photos = [];
  for (let index = 0; index < files.length; index += 1) {
    setStatus("", `현장사진 ${index + 1}/${files.length} 용량을 줄이는 중입니다...`);
    photos.push(await compressPhoto(files[index], index));
  }
  return photos;
}

function buildPayload(form, photos) {
  const attribution = captureAttribution();
  const requestKind = valueOf(form, "requestKind");
  const region = valueOf(form, "region");
  const quantity = valueOf(form, "quantity") || "미정";
  const userMessage = valueOf(form, "message");
  const summary = [
    `요청 구분: ${requestKind}`,
    `설치 지역: ${region}`,
    `예상 수량: ${quantity}`,
    valueOf(form, "siteType") ? `현장 유형: ${valueOf(form, "siteType")}` : "",
    valueOf(form, "productPreference") ? `제품 방식: ${valueOf(form, "productPreference")}` : "",
    userMessage ? `추가 내용: ${userMessage}` : "추가 내용: 없음"
  ].filter(Boolean).join("\n");
  return {
    companyName: valueOf(form, "companyName"),
    contactName: valueOf(form, "contactName"),
    phone: valueOf(form, "phone"),
    email: valueOf(form, "email"),
    inquiryType: "볼라드 제작·교체·시공",
    subject: `${region} 볼라드 ${requestKind} 견적 요청`,
    message: summary,
    requestKind,
    region,
    quantity,
    siteType: valueOf(form, "siteType"),
    productPreference: valueOf(form, "productPreference"),
    contactPreference: valueOf(form, "contactPreference"),
    privacyConsent: true,
    website: valueOf(form, "website"),
    photos,
    pageUrl: location.href,
    siteUrl: location.origin,
    userAgent: navigator.userAgent,
    ...attribution
  };
}

async function submitQuote(form) {
  if (isSubmitting) return;
  const now = Date.now();
  if (lastSubmitAt && now - lastSubmitAt < CONTACT_COOLDOWN_MS) {
    setStatus("error", "잠시 후 다시 전송해 주세요.");
    return;
  }
  if (!validateForm(form)) return;
  const submit = form.querySelector("[data-submit]");
  const defaultText = submit?.textContent || "현장사진 견적 요청하기";
  isSubmitting = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "견적 요청을 전송하고 있습니다...";
  }
  try {
    trackEvent("Quote Submit Started", "bollard_form");
    const files = Array.from(form.elements.photos?.files || []);
    const photos = await preparePhotos(files);
    setStatus("", "견적 요청을 안전하게 전송하는 중입니다...");
    const response = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(form, photos))
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || "CONTACT_FAILED");
    form.reset();
    updatePhotoList(form);
    lastSubmitAt = Date.now();
    trackEvent("Quote Submitted", "bollard_form");
    const leadText = result.leadId ? ` 접수번호: ${result.leadId}` : "";
    setStatus("success", `견적 요청이 정상 접수되었습니다.${leadText} 담당자가 확인 후 연락드리겠습니다.`);
  } catch (error) {
    trackEvent("Quote Submit Failed", "bollard_form");
    const message = error instanceof Error && error.message && error.message !== "CONTACT_FAILED"
      ? error.message
      : "문의 접수에 실패했습니다. 031-852-2918로 전화 부탁드립니다.";
    setStatus("error", message);
  } finally {
    isSubmitting = false;
    if (submit) {
      submit.disabled = false;
      submit.textContent = defaultText;
    }
  }
}

function updatePhotoList(form) {
  const output = form.querySelector("[data-photo-list]");
  if (!output) return;
  const files = Array.from(form.elements.photos?.files || []);
  if (!files.length) {
    output.textContent = "선택된 사진 없음";
    return;
  }
  output.textContent = files.slice(0, MAX_PHOTOS).map((file) => file.name).join(" · ");
  if (files.length > MAX_PHOTOS) output.textContent += ` · 최대 ${MAX_PHOTOS}장만 전송됩니다`;
}

function bindTracking() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-track]");
    if (!target) return;
    const key = target.dataset.track || "unknown";
    if (key.startsWith("phone")) trackEvent("Phone Clicked", key);
    else if (key.startsWith("kakao")) trackEvent("Kakao Clicked", key);
    else if (key.startsWith("quote")) trackEvent("Quote CTA Clicked", key);
    else if (key.includes("download")) trackEvent("Document Opened", key);
    else trackEvent("Lead CTA Clicked", key);
  });
}

function bindForm() {
  const form = document.querySelector("[data-bollard-form]");
  if (!form) return;
  form.addEventListener("input", () => {
    if (!formStarted) {
      formStarted = true;
      trackEvent("Quote Form Started", "bollard_form");
    }
  }, { once: true });
  form.elements.photos?.addEventListener("change", () => updatePhotoList(form));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitQuote(form);
  });
}

injectVercelAnalytics();
captureAttribution();
bindTracking();
bindForm();
