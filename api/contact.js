const RECEIVER_FALLBACK = "sn6221@naver.com";
const SITE_FALLBACK = "https://snplus.ai.kr";
const MAX_BODY_SIZE = 32 * 1024;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sanitizeText(value, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeMultiline(value, maxLength = 3000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return value
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

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY_SIZE) {
      throw new Error("Request body too large");
    }
  }

  return raw ? JSON.parse(raw) : {};
}

function buildInquiry(rawBody) {
  const body = rawBody ?? {};
  const inquiry = {
    companyName: sanitizeText(body.companyName, 120),
    contactName: sanitizeText(body.contactName, 80),
    phone: sanitizeText(body.phone, 40),
    email: sanitizeText(body.email, 160),
    inquiryType: sanitizeText(body.inquiryType, 120),
    subject: sanitizeText(body.subject, 180),
    message: sanitizeMultiline(body.message, 3000),
    privacyConsent: body.privacyConsent === true || body.privacyConsent === "true",
    website: sanitizeText(body.website, 160),
    pageUrl: sanitizeText(body.pageUrl, 500),
    siteUrl: sanitizeText(body.siteUrl, 200) || process.env.VITE_SITE_URL || SITE_FALLBACK,
    userAgent: sanitizeText(body.userAgent || "", 500),
    receivedAt: formatKoreanTime()
  };

  return inquiry;
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
  if (inquiry.companyName && inquiry.contactName) {
    return `[SNPLUS 견적문의] ${inquiry.companyName} - ${inquiry.contactName}`;
  }

  return "[SNPLUS 견적문의] 신규 문의 접수";
}

function buildMailBody(inquiry) {
  const rows = [
    ["회사명", inquiry.companyName],
    ["담당자명", inquiry.contactName],
    ["연락처", inquiry.phone],
    ["이메일", inquiry.email || "-"],
    ["문의유형", inquiry.inquiryType || "-"],
    ["문의제목", inquiry.subject || "-"],
    ["문의내용", inquiry.message],
    ["접수시간", inquiry.receivedAt],
    ["접수페이지", inquiry.pageUrl || "-"],
    ["사이트", inquiry.siteUrl],
    ["User Agent", inquiry.userAgent || "-"]
  ];

  const text = `${rows.map(([label, value]) => `${label}:\n${value}`).join("\n\n")}\n\n이 메일은 snplus.ai.kr 견적센터 문의폼을 통해 자동 발송되었습니다.`;

  const htmlRows = rows
    .map(([label, value]) => {
      const escapedValue = escapeHtml(value).replace(/\n/g, "<br />");
      return `<tr><th>${escapeHtml(label)}</th><td>${escapedValue}</td></tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; padding: 24px; background: #f4f7f7; color: #152126; font-family: Arial, "Malgun Gothic", sans-serif; }
      .wrap { max-width: 720px; margin: 0 auto; border: 1px solid #d8e2e2; border-radius: 12px; background: #ffffff; overflow: hidden; }
      .head { padding: 24px; background: #0f2026; color: #ffffff; }
      .head h1 { margin: 0; font-size: 22px; }
      .body { padding: 24px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 14px 12px; border-bottom: 1px solid #e8eeee; vertical-align: top; text-align: left; font-size: 14px; line-height: 1.6; }
      th { width: 120px; color: #1c9b9a; }
      .foot { padding: 18px 24px; background: #f8fbfb; color: #5c6f78; font-size: 13px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="head"><h1>SNPLUS 견적문의 접수</h1></div>
      <div class="body"><table>${htmlRows}</table></div>
      <div class="foot">이 메일은 snplus.ai.kr 견적센터 문의폼을 통해 자동 발송되었습니다.</div>
    </div>
  </body>
</html>`;

  return { html, text };
}

async function sendMail(inquiry) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;
  const receiverEmail = process.env.CONTACT_RECEIVER_EMAIL || RECEIVER_FALLBACK;

  if (!apiKey || !fromEmail) {
    console.error("Contact mail configuration missing", {
      hasResendKey: Boolean(apiKey),
      hasFromEmail: Boolean(fromEmail)
    });
    throw new Error("MAIL_CONFIGURATION_MISSING");
  }

  const { html, text } = buildMailBody(inquiry);
  const payload = {
    from: fromEmail,
    to: [receiverEmail],
    subject: buildMailSubject(inquiry),
    html,
    text
  };

  if (inquiry.email) {
    payload.reply_to = inquiry.email;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Resend email send failed", {
      status: response.status,
      body: errorBody.slice(0, 300)
    });
    throw new Error("MAIL_SEND_FAILED");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  }

  try {
    const rawBody = await readJsonBody(req);
    const inquiry = buildInquiry(rawBody);

    if (inquiry.website) {
      return sendJson(res, 200, { ok: true });
    }

    const validationErrors = validateInquiry(inquiry);
    if (validationErrors.length > 0) {
      console.warn("Invalid contact inquiry", { fields: validationErrors });
      return sendJson(res, 400, { ok: false, message: "입력값을 확인해 주세요." });
    }

    await sendMail(inquiry);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("Contact API failed", { message: error.message });
    return sendJson(res, 500, {
      ok: false,
      message: "문의 접수에 실패했습니다. 전화 또는 이메일로 연락 부탁드립니다."
    });
  }
}
