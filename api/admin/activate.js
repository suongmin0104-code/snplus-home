import {
  createSessionToken,
  getAdminConfig,
  isAdminConfigured,
  readJsonBody,
  sendJson,
  setSessionCookie
} from "../../lib/admin-auth.js";
import { activateAdminUser, normalizePhoneId } from "../../lib/admin-user-store.js";

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;

function clientKey(req, phone) {
  const ip = String(req.headers?.["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown")
    .split(",")[0]
    .trim();
  return `${ip}:${phone}`;
}

function isRateLimited(key, now = Date.now()) {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return current.count >= MAX_ATTEMPTS;
}

function recordFailure(key) {
  const current = attempts.get(key);
  if (current) current.count += 1;
}

function activationMessage(error) {
  if (error?.message === "ADMIN_ACTIVATION_EXPIRED") return "등록코드가 만료되었습니다. 총책임자에게 새 코드를 요청해 주세요.";
  if (error?.message === "ADMIN_PASSWORD_POLICY") return "비밀번호는 10자 이상이며 문자와 숫자를 모두 포함해야 합니다.";
  return "전화번호 또는 등록코드를 확인해 주세요.";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  }

  const config = getAdminConfig();
  if (!isAdminConfigured(config)) {
    return sendJson(res, 503, { ok: false, configured: false, message: "관리자 환경설정이 완료되지 않았습니다." });
  }

  try {
    const body = await readJsonBody(req);
    const phone = normalizePhoneId(body.username ?? body.phone);
    const key = clientKey(req, phone);
    if (isRateLimited(key)) {
      return sendJson(res, 429, { ok: false, message: "등록 시도가 많습니다. 15분 후 다시 시도해 주세요." });
    }
    if (!phone || body.password !== body.passwordConfirm) {
      recordFailure(key);
      return sendJson(res, 400, { ok: false, message: "전화번호와 비밀번호 확인란을 확인해 주세요." });
    }

    const user = await activateAdminUser(phone, body.activationCode, body.password);
    attempts.delete(key);
    const token = createSessionToken(user.id, config.sessionSecret);
    setSessionCookie(res, token);
    return sendJson(res, 200, { ok: true, authenticated: true, user });
  } catch (error) {
    const bodyPhone = normalizePhoneId(req.body?.username ?? req.body?.phone);
    if (bodyPhone) recordFailure(clientKey(req, bodyPhone));
    return sendJson(res, 400, { ok: false, message: activationMessage(error) });
  }
}
