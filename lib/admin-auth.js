import {
  createHmac,
  timingSafeEqual
} from "node:crypto";

import {
  ADMIN_PERMISSION_IDS,
  normalizePhoneId,
  publicAdminUser,
  readAdminUser,
  verifyAdminSecret
} from "./admin-user-store.js";

export const ADMIN_COOKIE_NAME = "sn_admin_session";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

const MAX_BODY_SIZE = 16 * 1024;

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.end(JSON.stringify(payload));
}

export async function readJsonBody(req) {
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
      throw new Error("REQUEST_BODY_TOO_LARGE");
    }
  }

  return raw ? JSON.parse(raw) : {};
}

export function getAdminConfig() {
  return {
    username: process.env.ADMIN_USERNAME?.trim() ?? "",
    passwordHash: process.env.ADMIN_PASSWORD_HASH?.trim() ?? "",
    sessionSecret: process.env.ADMIN_SESSION_SECRET?.trim() ?? ""
  };
}

export function isAdminConfigured(config = getAdminConfig()) {
  return Boolean(
    config.username &&
      config.passwordHash.startsWith("scrypt$") &&
      config.sessionSecret.length >= 32
  );
}

export function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || password.length < 10 || password.length > 200) {
    return false;
  }
  return verifyAdminSecret(password, storedHash);
}

function encode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function usernamesMatch(input, configuredUsername) {
  return safeEqual(String(input ?? "").trim(), configuredUsername);
}

export function createSessionToken(username, secret, now = Date.now()) {
  const payload = encode(
    JSON.stringify({
      sub: username,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + ADMIN_SESSION_SECONDS,
      v: 2
    })
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (!token || !secret) {
    return null;
  }

  const [payload, signature] = String(token).split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) {
    return null;
  }

  try {
    const session = JSON.parse(decode(payload));
    if (
      ![1, 2].includes(session.v) ||
      typeof session.sub !== "string" ||
      !Number.isInteger(session.exp) ||
      session.exp <= Math.floor(now / 1000)
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, entry) => {
    const separator = entry.indexOf("=");
    if (separator < 0) return cookies;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

export function getSessionFromRequest(req, secret) {
  const cookies = parseCookies(req.headers?.cookie ?? "");
  return verifySessionToken(cookies[ADMIN_COOKIE_NAME], secret);
}

export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${ADMIN_SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
  );
}

export function createRootOwner(config = getAdminConfig()) {
  return {
    id: config.username,
    phone: normalizePhoneId(config.username) || config.username,
    name: "총책임자",
    title: "총책임자",
    role: "owner",
    status: "active",
    permissions: [...ADMIN_PERMISSION_IDS],
    protected: true
  };
}

export async function resolveSessionUser(session, config = getAdminConfig()) {
  if (!session?.sub) return null;
  if (usernamesMatch(session.sub, config.username)) return createRootOwner(config);

  const user = await readAdminUser(session.sub);
  if (!user || user.status !== "active" || !user.passwordHash) return null;
  return publicAdminUser(user);
}

export function hasAdminPermission(user, permission) {
  if (!permission) return true;
  if (user?.role === "owner") return true;
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

export async function requireAdmin(req, res, permission = "") {
  const config = getAdminConfig();
  if (!isAdminConfigured(config)) {
    sendJson(res, 503, {
      ok: false,
      configured: false,
      message: "관리자 환경설정이 완료되지 않았습니다."
    });
    return null;
  }

  const session = getSessionFromRequest(req, config.sessionSecret);
  let user = null;
  try {
    user = await resolveSessionUser(session, config);
  } catch (error) {
    console.error("ADMIN_SESSION_USER_LOOKUP_FAILED", error?.message ?? error);
    sendJson(res, 503, {
      ok: false,
      configured: true,
      message: "직원 계정 저장소를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."
    });
    return null;
  }

  if (!session || !user) {
    sendJson(res, 401, {
      ok: false,
      configured: true,
      authenticated: false,
      message: "로그인이 필요합니다."
    });
    return null;
  }

  if (!hasAdminPermission(user, permission)) {
    sendJson(res, 403, {
      ok: false,
      configured: true,
      authenticated: true,
      message: "이 업무를 사용할 권한이 없습니다. 총책임자에게 문의해 주세요."
    });
    return null;
  }

  return { config, session, user };
}

export function getSafeIntegrationUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}
