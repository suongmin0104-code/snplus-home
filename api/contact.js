import { randomUUID } from "node:crypto";

const RECEIVER_FALLBACK = "sn6221@naver.com";
const SITE_FALLBACK = "https://snplus.ai.kr";
const MAX_BODY_SIZE = 3 * 1024 * 1024;
const MAX_PHOTOS = 2;
const MAX_PHOTO_BYTES = 700 * 1024;
const ALLOWED_PHOTO_TYPES = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
});

let contactStoreForTests = null;

export function setContactStoreForTests(store) {
  contactStoreForTests = store && typeof store === "object" ? store : null;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(payload));
}

function sanitizeText(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeMultiline(value, maxLength = 3000) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidPhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 12 && /^[0-9+\-().\s]+$/.test(value);
}

function isValidEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatKoreanTime(date = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function createLeadId(date = new Date()) {
  const koreaDate = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
  return `SN-${koreaDate}-${randomUUID().split("-")[0].toUpperCase()}`;
}

function safeFileName(value, extension, index) {
  const raw = sanitizeText(value, 120) || `현장사진-${index + 1}`;
  const withoutExtension = raw.replace(/\.[a-zA-Z0-9]{1,6}$/i, "");
  const safe = withoutExtension.replace(/[\r\n"\\/<>:*?|]+/g, "-").trim().slice(0, 80) || `현장사진-${index + 1}`;
  return `${safe}.${extension}`;
}

function matchesImageSignature(buffer, contentType) {
  if (contentType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/webp") {
    return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

function parsePhoto(rawPhoto, index) {
  if (!rawPhoto || typeof rawPhoto !== "object") throw new Error("PHOTO_INVALID");
  const contentType = sanitizeText(rawPhoto.contentType, 80).toLowerCase();
  const extension = ALLOWED_PHOTO_TYPES[contentType];
  if (!extension) throw new Error("PHOTO_TYPE_INVALID");
  const rawContent = typeof rawPhoto.content === "string" ? rawPhoto.content : "";
  const content = rawContent.replace(/^data:[^;]+;base64,/i, "").replace(/\s/g, "");
  const maximumEncodedLength = Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 8;
  if (!content || content.length > maximumEncodedLength || !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) {
    throw new Error("PHOTO_INVALID");
  }
  const buffer = Buffer.from(content, "base64");
  const normalized = buffer.toString("base64").replace(/=+$/, "");
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES || normalized !== content.replace(/=+$/, "")) {
    throw new Error(buffer.length > MAX_PHOTO_BYTES ? "PHOTO_TOO_LARGE" : "PHOTO_INVALID");
  }
  if (!matchesImageSignature(buffer, contentType)) throw new Error("PHOTO_INVALID");
  return {
    name: safeFileName(rawPhoto.name, extension, index),
    contentType,
    size: buffer.length,
    content: buffer.toString("base64")
  };
}

function parsePhotos(value) {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) throw new Error("PHOTO_INVALID");
  if (value.length > MAX_PHOTOS) throw new Error("PHOTO_COUNT_EXCEEDED");
  return value.map(parsePhoto);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    const serialized = JSON.stringify(req.body);
    if (Buffer.byteLength(serialized) > MAX_BODY_SIZE) throw new Error("REQUEST_BODY_TOO_LARGE");
    return req.body;
  }
  if (typeof req.body === "string") {
    if (Buffer.byteLength(req.body) > MAX_BODY_SIZE) throw new Error("REQUEST_BODY_TOO_LARGE");
    return JSON.parse(req.body);
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_SIZE) throw new Error("REQUEST_BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function buildInquiry(rawBody) {
  const body = rawBody ?? {};
  const receivedAt = new Date();
  return {
    leadId: createLeadId(receivedAt),
    companyName: sanitizeText(body.companyName, 120),
    contactName: sanitizeText(body.contactName, 80),
    phone: sanitizeText(body.phone, 40),
    email: sanitizeText(body.email, 160),
    inquiryType: sanitizeText(body.inquiryType, 120),
    subject: sanitizeText(body.subject, 180),
    message: sanitizeMultiline(body.message, 3000),
    requestKind: sanitizeText(body.requestKind, 120),
    region: sanitizeText(body.region, 120),
    quantity: sanitizeText(body.quantity, 80),
    siteType: sanitizeText(body.siteType, 120),
    productPreference: sanitizeText(body.productPreference, 120),
    contactPreference: sanitizeText(body.contactPreference, 80),
    privacyConsent: body.privacyConsent === true || body.privacyConsent === "true",
    website: sanitizeText(body.website, 160),
    photos: parsePhotos(body.photos),
    pageUrl: sanitizeText(body.pageUrl, 500),
    siteUrl: sanitizeText(body.siteUrl, 200) || process.env.VITE_SITE_URL || SITE_FALLBACK,
    userAgent: sanitizeText(body.userAgent || "", 500),
    utmSource: sanitizeText(body.utmSource, 160),
    utmMedium: sanitizeText(body.utmMedium, 160),
    utmCampaign: sanitizeText(body.utmCampaign, 200),
    utmTerm: sanitizeText(body.utmTerm, 200),
    utmContent: sanitizeText(body.utmContent, 200),
    referrer: sanitizeText(body.referrer, 500),
    landingPage: sanitizeText(body.landingPage, 500),
    firstSeenAt: sanitizeText(body.firstSeenAt, 80),
    receivedAt: formatKoreanTime(receivedAt),
    receivedAtIso: receivedAt.toISOString()
  };
}

function validateInquiry(inquiry) {
  const errors = [];
  if (!inquiry.companyName) errors.push("companyName");
  if (!inquiry.contactName) errors.push("contactName");
  if (!inquiry.phone || !isValidPhone(inquiry.phone)) errors.push("phone");
  if (inquiry.email && !isValidEmail(inquiry.email)) errors.push("email");
  if (!inquiry.message) errors.push("message");
  if (!inquiry.privacyConsent) errors.push("privacyConsent");
  return errors;
}

function buildMailSubject(inquiry) {
  const type = inquiry.inquiryType ? `[${inquiry.inquiryType}]` : "";
  return `[SNPLUS 견적문의]${type} ${inquiry.companyName} - ${inquiry.contactName}`.slice(0, 190);
}

function buildMailBody(inquiry) {
  const campaign = [
    inquiry.utmSource && `source=${inquiry.utmSource}`,
    inquiry.utmMedium && `medium=${inquiry.utmMedium}`,
    inquiry.utmCampaign && `campaign=${inquiry.utmCampaign}`,
    inquiry.utmTerm && `term=${inquiry.utmTerm}`,
    inquiry.utmContent && `content=${inquiry.utmContent}`
  ].filter(Boolean).join(" | ") || "직접 유입 또는 미확인";
  const rows = [
    ["접수번호", inquiry.leadId], ["회사·현장명", inquiry.companyName], ["담당자명", inquiry.contactName],
    ["연락처", inquiry.phone], ["이메일", inquiry.email || "-"], ["문의유형", inquiry.inquiryType || "-"],
    ["문의제목", inquiry.subject || "-"], ["요청구분", inquiry.requestKind || "-"], ["설치지역", inquiry.region || "-"],
    ["예상수량", inquiry.quantity || "-"], ["현장유형", inquiry.siteType || "-"], ["제품방식", inquiry.productPreference || "-"],
    ["선호연락", inquiry.contactPreference || "-"], ["문의내용", inquiry.message],
    ["현장사진", inquiry.photos.length ? `${inquiry.photos.length}장 첨부` : "첨부 없음"],
    ["광고·유입", campaign], ["이전페이지", inquiry.referrer || "직접 유입"], ["첫 진입페이지", inquiry.landingPage || "-"],
    ["접수페이지", inquiry.pageUrl || "-"], ["최초방문기록", inquiry.firstSeenAt || "-"], ["접수시간", inquiry.receivedAt],
    ["사이트", inquiry.siteUrl], ["User Agent", inquiry.userAgent || "-"]
  ];
  const text = `${rows.map(([label, value]) => `${label}:\n${value}`).join("\n\n")}\n\n이 메일은 snplus.ai.kr 견적센터 문의폼을 통해 자동 발송되었습니다.`;
  const htmlRows = rows.map(([label, value]) => {
    const escapedValue = escapeHtml(value).replace(/\n/g, "<br />");
    return `<tr><th>${escapeHtml(label)}</th><td>${escapedValue}</td></tr>`;
  }).join("");
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><style>body{margin:0;padding:24px;background:#f4f7f7;color:#152126;font-family:Arial,"Malgun Gothic",sans-serif}.wrap{max-width:760px;margin:0 auto;border:1px solid #d8e2e2;border-radius:12px;background:#fff;overflow:hidden}.head{padding:24px;background:#0f2026;color:#fff}.head h1{margin:0;font-size:22px}.head p{margin:8px 0 0;color:#a9c7c7;font-size:13px}.body{padding:24px}table{width:100%;border-collapse:collapse}th,td{padding:14px 12px;border-bottom:1px solid #e8eeee;vertical-align:top;text-align:left;font-size:14px;line-height:1.6}th{width:130px;color:#087f80}.foot{padding:18px 24px;background:#f8fbfb;color:#5c6f78;font-size:13px}</style></head><body><div class="wrap"><div class="head"><h1>SNPLUS 견적문의 접수</h1><p>${escapeHtml(inquiry.leadId)}</p></div><div class="body"><table>${htmlRows}</table></div><div class="foot">현장사진이 첨부된 경우 메일 첨부파일에서 확인할 수 있습니다.</div></div></body></html>`;
  return { html, text };
}

async function sendMail(inquiry) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;
  const receiverEmail = process.env.CONTACT_RECEIVER_EMAIL || RECEIVER_FALLBACK;
  if (!apiKey || !fromEmail) {
    console.error("CONTACT_MAIL_CONFIGURATION_MISSING", { hasResendKey: Boolean(apiKey), hasFromEmail: Boolean(fromEmail) });
    throw new Error("MAIL_CONFIGURATION_MISSING");
  }
  const { html, text } = buildMailBody(inquiry);
  const payload = { from: fromEmail, to: [receiverEmail], subject: buildMailSubject(inquiry), html, text };
  if (inquiry.email) payload.reply_to = inquiry.email;
  if (inquiry.photos.length) {
    payload.attachments = inquiry.photos.map((photo) => ({ content: photo.content, filename: photo.name, content_type: photo.contentType }));
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "snplus-contact/0.14.0",
      "Idempotency-Key": inquiry.leadId
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("CONTACT_RESEND_FAILED", { status: response.status, leadId: inquiry.leadId, body: errorBody.slice(0, 300) });
    throw new Error("MAIL_SEND_FAILED");
  }
}

async function saveInquiry(inquiry, notification) {
  if (contactStoreForTests?.save) return contactStoreForTests.save(inquiry, notification);
  const { saveContactInquiry } = await import("../lib/contact-store.js");
  return saveContactInquiry(inquiry, notification);
}

async function updateInquiryNotification(entry, notification) {
  if (contactStoreForTests?.updateNotification) {
    return contactStoreForTests.updateNotification(entry, notification);
  }
  const { updateContactNotification } = await import("../lib/contact-store.js");
  return updateContactNotification(entry, notification);
}

function clientErrorResponse(error) {
  const code = error instanceof Error ? error.message : "";
  if (code === "REQUEST_BODY_TOO_LARGE") return { status: 413, message: "첨부 용량이 너무 큽니다. 사진 수 또는 용량을 줄여 주세요." };
  if (code === "PHOTO_COUNT_EXCEEDED") return { status: 400, message: `현장사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.` };
  if (code === "PHOTO_TOO_LARGE") return { status: 400, message: "현장사진은 한 장당 700KB 이하로 전송해 주세요." };
  if (["PHOTO_INVALID", "PHOTO_TYPE_INVALID"].includes(code)) return { status: 400, message: "현장사진 파일을 확인해 주세요. JPG, PNG, WEBP만 가능합니다." };
  if (error instanceof SyntaxError) return { status: 400, message: "전송된 문의 내용을 확인해 주세요." };
  return null;
}

function serverErrorResponse(error) {
  const code = error instanceof Error ? error.message : "";
  if (code === "MAIL_CONFIGURATION_MISSING") {
    return { status: 503, errorCode: "MAIL_CONFIGURATION_MISSING" };
  }
  if (code === "MAIL_SEND_FAILED") {
    return { status: 502, errorCode: "MAIL_PROVIDER_REJECTED" };
  }
  if (code === "CONTACT_STORAGE_FAILED") {
    return { status: 503, errorCode: "CONTACT_STORAGE_FAILED" };
  }
  if (code === "CONTACT_DELIVERY_UNAVAILABLE") {
    return { status: 503, errorCode: "CONTACT_DELIVERY_UNAVAILABLE" };
  }
  return { status: 500, errorCode: "CONTACT_DELIVERY_FAILED" };
}

function notificationFromMailResult(mailSent, mailError) {
  const now = new Date().toISOString();
  if (mailSent) return { status: "sent", provider: "resend", updatedAt: now, errorCode: "" };
  const code = mailError instanceof Error ? mailError.message : "";
  if (code === "MAIL_CONFIGURATION_MISSING") {
    return { status: "not_configured", provider: "resend", updatedAt: now, errorCode: "MAIL_CONFIGURATION_MISSING" };
  }
  if (code === "MAIL_SEND_FAILED") {
    return { status: "failed", provider: "resend", updatedAt: now, errorCode: "MAIL_PROVIDER_REJECTED" };
  }
  return { status: "failed", provider: "resend", updatedAt: now, errorCode: "CONTACT_MAIL_UNKNOWN" };
}

function combinedDeliveryError(storageError, mailError) {
  if (storageError && mailError) return new Error("CONTACT_DELIVERY_UNAVAILABLE");
  return storageError || mailError || new Error("CONTACT_DELIVERY_FAILED");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  }

  try {
    const rawBody = await readJsonBody(req);
    const inquiry = buildInquiry(rawBody);
    if (inquiry.website) return sendJson(res, 200, { ok: true });

    const validationErrors = validateInquiry(inquiry);
    if (validationErrors.length > 0) {
      console.warn("CONTACT_VALIDATION_FAILED", { fields: validationErrors });
      return sendJson(res, 400, { ok: false, message: "필수 입력값을 확인해 주세요." });
    }

    let storedEntry = null;
    let storageError = null;
    try {
      storedEntry = await saveInquiry(inquiry, {
        status: "pending",
        provider: "resend",
        updatedAt: new Date().toISOString(),
        errorCode: ""
      });
    } catch (error) {
      storageError = error instanceof Error ? error : new Error("CONTACT_STORAGE_FAILED");
      console.error("CONTACT_PERSISTENCE_FAILED", { leadId: inquiry.leadId, message: storageError.message });
    }

    let mailSent = false;
    let mailError = null;
    try {
      await sendMail(inquiry);
      mailSent = true;
    } catch (error) {
      mailError = error instanceof Error ? error : new Error("MAIL_SEND_FAILED");
    }

    if (storedEntry) {
      try {
        storedEntry = await updateInquiryNotification(storedEntry, notificationFromMailResult(mailSent, mailError));
      } catch (error) {
        console.error("CONTACT_NOTIFICATION_STATUS_SAVE_FAILED", {
          leadId: inquiry.leadId,
          message: error instanceof Error ? error.message : "UNKNOWN"
        });
      }
    }

    if (storedEntry || mailSent) {
      return sendJson(res, 200, {
        ok: true,
        leadId: inquiry.leadId,
        stored: Boolean(storedEntry),
        notified: mailSent
      });
    }

    throw combinedDeliveryError(storageError, mailError);
  } catch (error) {
    const clientError = clientErrorResponse(error);
    if (clientError) return sendJson(res, clientError.status, { ok: false, message: clientError.message });

    const serverError = serverErrorResponse(error);
    console.error("CONTACT_API_FAILED", {
      errorCode: serverError.errorCode,
      message: error instanceof Error ? error.message : "UNKNOWN"
    });
    return sendJson(res, serverError.status, {
      ok: false,
      errorCode: serverError.errorCode,
      message: "문의 접수에 실패했습니다. 031-852-2918 또는 sn6221@naver.com으로 연락 부탁드립니다."
    });
  }
}
