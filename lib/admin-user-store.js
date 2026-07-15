import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { get, list, put } from "@vercel/blob";

export const ADMIN_USER_PREFIX = "admin-users/entries/";
export const ADMIN_PERMISSION_DEFINITIONS = Object.freeze([
  { id: "estimate", label: "견적 관리·문서 작성" },
  { id: "tax", label: "세무·회계" },
  { id: "clients", label: "거래처" },
  { id: "worklog", label: "일정·현장 업무일지" },
  { id: "documents", label: "업무 서식·사내 자료" }
]);
export const ADMIN_PERMISSION_IDS = Object.freeze(
  ADMIN_PERMISSION_DEFINITIONS.map((permission) => permission.id)
);

const PHONE_PATTERN = /^0\d{9,10}$/;
const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const INVITE_LENGTH = 10;
const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function cleanText(value, maximumLength) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximumLength);
}

function userPath(id) {
  return `${ADMIN_USER_PREFIX}${id}.json`;
}

async function streamToText(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function writeAdminUser(user) {
  await put(userPath(user.id), JSON.stringify(user), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60
  });
  return user;
}

function makeActivationCode() {
  const bytes = randomBytes(INVITE_LENGTH);
  return [...bytes]
    .map((byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length])
    .join("");
}

function normalizePermissions(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => ADMIN_PERMISSION_IDS.includes(value)))];
}

export function normalizePhoneId(value) {
  const id = String(value ?? "").replace(/\D/g, "");
  return PHONE_PATTERN.test(id) ? id : "";
}

export function formatPhoneId(value) {
  const id = normalizePhoneId(value);
  if (!id) return String(value ?? "");
  if (id.length === 11) return `${id.slice(0, 3)}-${id.slice(3, 7)}-${id.slice(7)}`;
  return `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`;
}

export function hashAdminSecret(secret) {
  const value = String(secret ?? "");
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(value, salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

export function verifyAdminSecret(secret, storedHash) {
  const [algorithm, salt, digest] = String(storedHash ?? "").split("$");
  if (algorithm !== "scrypt" || !salt || !digest) return false;

  try {
    const expected = Buffer.from(digest, "hex");
    const actual = scryptSync(String(secret ?? ""), salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function passwordMeetsPolicy(password, phoneId = "") {
  const value = String(password ?? "");
  return value.length >= 10
    && value.length <= 200
    && /[A-Za-z가-힣]/.test(value)
    && /\d/.test(value)
    && value !== phoneId;
}

export function publicAdminUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone || user.id,
    phoneFormatted: formatPhoneId(user.phone || user.id),
    name: user.name || formatPhoneId(user.id),
    title: user.title || "직원",
    role: user.role === "owner" ? "owner" : "staff",
    status: user.status,
    permissions: normalizePermissions(user.permissions),
    protected: Boolean(user.protected),
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    lastLoginAt: user.lastLoginAt || null,
    activationExpiresAt: user.activationExpiresAt || null
  };
}

export async function readAdminUser(value) {
  const id = normalizePhoneId(value);
  if (!id) return null;
  const result = await get(userPath(id), { access: "private", useCache: false });
  if (!result?.stream) return null;

  try {
    const user = JSON.parse(await streamToText(result.stream));
    return user?.id === id ? user : null;
  } catch {
    return null;
  }
}

export async function listAdminUsers() {
  const blobs = [];
  let cursor;
  do {
    const result = await list({ prefix: ADMIN_USER_PREFIX, limit: 250, cursor });
    blobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor && blobs.length < 500);

  const users = await Promise.all(
    blobs.slice(0, 500).map((blob) => {
      const id = blob.pathname.slice(ADMIN_USER_PREFIX.length).replace(/\.json$/, "");
      return readAdminUser(id);
    })
  );
  return users.filter(Boolean).sort((left, right) => left.name.localeCompare(right.name, "ko"));
}

export async function createAdminUser(input, actorId) {
  const id = normalizePhoneId(input?.phone ?? input?.id);
  const name = cleanText(input?.name, 60);
  if (!id) throw new Error("ADMIN_USER_PHONE_INVALID");
  if (!name) throw new Error("ADMIN_USER_NAME_REQUIRED");
  if (await readAdminUser(id)) throw new Error("ADMIN_USER_EXISTS");

  const activationCode = makeActivationCode();
  const now = new Date();
  const user = {
    id,
    phone: id,
    name,
    title: cleanText(input?.title, 40) || "직원",
    role: "staff",
    status: "pending",
    permissions: normalizePermissions(input?.permissions),
    passwordHash: "",
    activationHash: hashAdminSecret(activationCode),
    activationExpiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS).toISOString(),
    createdAt: now.toISOString(),
    createdBy: cleanText(actorId, 40),
    updatedAt: now.toISOString(),
    updatedBy: cleanText(actorId, 40),
    lastLoginAt: null
  };
  await writeAdminUser(user);
  return { user: publicAdminUser(user), activationCode };
}

export async function updateAdminUser(value, patch, actorId) {
  const id = normalizePhoneId(value);
  const existing = await readAdminUser(id);
  if (!existing) throw new Error("ADMIN_USER_NOT_FOUND");

  const requestedStatus = ["pending", "active", "disabled"].includes(patch?.status)
    ? patch.status
    : existing.status;
  const status = requestedStatus === "active" && !existing.passwordHash ? "pending" : requestedStatus;
  const now = new Date().toISOString();
  const user = {
    ...existing,
    name: cleanText(patch?.name ?? existing.name, 60) || existing.name,
    title: cleanText(patch?.title ?? existing.title, 40) || "직원",
    permissions: patch?.permissions === undefined
      ? normalizePermissions(existing.permissions)
      : normalizePermissions(patch.permissions),
    status,
    updatedAt: now,
    updatedBy: cleanText(actorId, 40)
  };
  await writeAdminUser(user);
  return publicAdminUser(user);
}

export async function resetAdminUserActivation(value, actorId) {
  const id = normalizePhoneId(value);
  const existing = await readAdminUser(id);
  if (!existing) throw new Error("ADMIN_USER_NOT_FOUND");

  const activationCode = makeActivationCode();
  const now = new Date();
  const user = {
    ...existing,
    status: "pending",
    passwordHash: "",
    activationHash: hashAdminSecret(activationCode),
    activationExpiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS).toISOString(),
    updatedAt: now.toISOString(),
    updatedBy: cleanText(actorId, 40)
  };
  await writeAdminUser(user);
  return { user: publicAdminUser(user), activationCode };
}

export async function activateAdminUser(value, activationCode, password) {
  const id = normalizePhoneId(value);
  const existing = await readAdminUser(id);
  if (!existing || existing.status !== "pending" || !existing.activationHash) {
    throw new Error("ADMIN_ACTIVATION_INVALID");
  }
  if (Date.parse(existing.activationExpiresAt) <= Date.now()) {
    throw new Error("ADMIN_ACTIVATION_EXPIRED");
  }
  if (!verifyAdminSecret(String(activationCode ?? "").trim().toUpperCase(), existing.activationHash)) {
    throw new Error("ADMIN_ACTIVATION_INVALID");
  }
  if (!passwordMeetsPolicy(password, id)) throw new Error("ADMIN_PASSWORD_POLICY");

  const now = new Date().toISOString();
  const user = {
    ...existing,
    status: "active",
    passwordHash: hashAdminSecret(password),
    activationHash: "",
    activationExpiresAt: null,
    passwordChangedAt: now,
    updatedAt: now,
    updatedBy: id
  };
  await writeAdminUser(user);
  return publicAdminUser(user);
}

export async function recordAdminUserLogin(value) {
  const existing = await readAdminUser(value);
  if (!existing) return;
  const now = new Date().toISOString();
  await writeAdminUser({ ...existing, lastLoginAt: now, updatedAt: now });
}
