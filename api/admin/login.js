import {
  createSessionToken,
  getAdminConfig,
  isAdminConfigured,
  readJsonBody,
  sendJson,
  setSessionCookie,
  usernamesMatch,
  verifyPassword
} from "../../lib/admin-auth.js";
import {
  normalizePhoneId,
  publicAdminUser,
  readAdminUser,
  recordAdminUserLogin
} from "../../lib/admin-user-store.js";

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function getClientKey(req) {
  return String(req.headers?.["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown")
    .split(",")[0]
    .trim();
}

function isRateLimited(key, now = Date.now()) {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return current.count >= MAX_ATTEMPTS;
}

function recordFailure(key, now = Date.now()) {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  }

  const config = getAdminConfig();
  if (!isAdminConfigured(config)) {
    return sendJson(res, 503, {
      ok: false,
      configured: false,
      message: "관리자 환경설정이 완료되지 않았습니다."
    });
  }

  const clientKey = getClientKey(req);
  if (isRateLimited(clientKey)) {
    return sendJson(res, 429, {
      ok: false,
      message: "로그인 시도가 많습니다. 15분 후 다시 시도해 주세요."
    });
  }

  try {
    const body = await readJsonBody(req);
    const usernameInput = typeof body.username === "string" ? body.username : "";
    const username = normalizePhoneId(usernameInput) || usernameInput.trim();
    const password = typeof body.password === "string" ? body.password : "";
    const isRootOwner = usernamesMatch(username, config.username);
    const employee = isRootOwner ? null : await readAdminUser(username);

    if (employee?.status === "pending") {
      return sendJson(res, 403, {
        ok: false,
        configured: true,
        activationRequired: true,
        message: "최초 비밀번호 등록이 필요합니다. 등록코드를 준비해 주세요."
      });
    }

    if (employee?.status === "disabled") {
      recordFailure(clientKey);
      return sendJson(res, 403, {
        ok: false,
        configured: true,
        message: "사용이 중지된 계정입니다. 총책임자에게 문의해 주세요."
      });
    }

    const storedHash = isRootOwner ? config.passwordHash : employee?.passwordHash;
    const validPassword = verifyPassword(password, storedHash);
    const validUsername = isRootOwner || Boolean(employee?.status === "active");

    if (!validUsername || !validPassword) {
      recordFailure(clientKey);
      return sendJson(res, 401, {
        ok: false,
        configured: true,
        message: "아이디 또는 비밀번호를 확인해 주세요."
      });
    }

    attempts.delete(clientKey);
    const token = createSessionToken(username, config.sessionSecret);
    setSessionCookie(res, token);
    if (employee) {
      recordAdminUserLogin(username).catch((error) => {
        console.error("ADMIN_LOGIN_RECORD_FAILED", error?.message ?? error);
      });
    }
    const user = isRootOwner
      ? { id: config.username, phone: config.username, name: "총책임자", title: "총책임자", role: "owner", status: "active", permissions: [] }
      : publicAdminUser(employee);
    return sendJson(res, 200, {
      ok: true,
      authenticated: true,
      user
    });
  } catch {
    return sendJson(res, 400, {
      ok: false,
      message: "로그인 요청 형식을 확인해 주세요."
    });
  }
}
