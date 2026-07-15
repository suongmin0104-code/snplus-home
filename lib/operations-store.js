import { randomUUID } from "node:crypto";

import { del, get, list, put } from "@vercel/blob";

const TENANT_KEY = "snplus";
const ROOT_PREFIX = `admin-operations/${TENANT_KEY}/`;
export const ESTIMATE_PREFIX = `${ROOT_PREFIX}estimates/`;
export const PRODUCTION_PREFIX = `${ROOT_PREFIX}production/`;
export const INVENTORY_PREFIX = `${ROOT_PREFIX}inventory/`;
export const INVENTORY_MOVEMENT_PREFIX = `${ROOT_PREFIX}inventory-movements/`;
export const INVENTORY_PHOTO_PREFIX = `${ROOT_PREFIX}inventory-photos/`;

const ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ESTIMATE_STATUSES = new Set(["estimating", "completed"]);
const PRODUCTION_PROCESSES = new Set(["cutting", "welding", "bending", "assembly", "inspection", "coating", "packing", "other"]);
const MOVEMENT_TYPES = new Set(["in", "out"]);
const PHOTO_PATTERN = /^admin-operations\/snplus\/inventory-photos\/[A-Za-z0-9_-]{8,80}\/[A-Za-z0-9-]+\.(?:jpg|png|webp)$/;

function cleanText(value, maximumLength) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximumLength);
}

function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function positiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 1000) / 1000) : fallback;
}

function makeId(value) {
  const proposed = cleanText(value, 80);
  return ID_PATTERN.test(proposed) ? proposed : randomUUID();
}

function itemPath(prefix, id) {
  return `${prefix}${id}.json`;
}

async function streamToText(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function readEntry(prefix, id) {
  if (!ID_PATTERN.test(String(id ?? ""))) return null;
  const result = await get(itemPath(prefix, id), { access: "private", useCache: false });
  if (!result?.stream) return null;
  try {
    return JSON.parse(await streamToText(result.stream));
  } catch {
    return null;
  }
}

async function listEntries(prefix, limit = 1000) {
  const blobs = [];
  let cursor;
  do {
    const result = await list({ prefix, limit: 250, cursor });
    blobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor && blobs.length < limit);

  const entries = await Promise.all(
    blobs.slice(0, limit).map((blob) => {
      const id = blob.pathname.slice(prefix.length).replace(/\.json$/, "");
      return readEntry(prefix, id);
    })
  );
  return entries.filter(Boolean);
}

async function writeEntry(prefix, entry) {
  await put(itemPath(prefix, entry.id), JSON.stringify(entry), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60
  });
  return entry;
}

function auditFields(existing, actorId) {
  const now = new Date().toISOString();
  return {
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || cleanText(actorId, 40),
    updatedAt: now,
    updatedBy: cleanText(actorId, 40)
  };
}

export function isOperationId(value) {
  return ID_PATTERN.test(String(value ?? ""));
}

export function isInventoryPhotoPath(value) {
  return PHOTO_PATTERN.test(String(value ?? ""));
}

export async function listEstimates() {
  return (await listEntries(ESTIMATE_PREFIX)).sort((left, right) => `${left.date}${left.title}`.localeCompare(`${right.date}${right.title}`, "ko"));
}

export async function saveEstimate(input, actorId = "") {
  const id = makeId(input?.id);
  const existing = await readEntry(ESTIMATE_PREFIX, id);
  const title = cleanText(input?.title, 140);
  const date = cleanText(input?.date, 10);
  if (!title) throw new Error("ESTIMATE_TITLE_REQUIRED");
  if (!validDate(date)) throw new Error("OPERATION_DATE_INVALID");

  return writeEntry(ESTIMATE_PREFIX, {
    id,
    tenantId: TENANT_KEY,
    title,
    date,
    clientName: cleanText(input?.clientName, 120),
    contactName: cleanText(input?.contactName, 60),
    contactPhone: cleanText(input?.contactPhone, 30),
    status: ESTIMATE_STATUSES.has(input?.status) ? input.status : "estimating",
    memo: cleanText(input?.memo, 3000),
    ...auditFields(existing, actorId)
  });
}

export async function deleteEstimate(id) {
  if (!isOperationId(id)) throw new Error("OPERATION_ID_INVALID");
  await del(itemPath(ESTIMATE_PREFIX, id));
}

export function summarizeEstimates(entries) {
  return {
    total: entries.length,
    estimating: entries.filter((entry) => entry.status === "estimating").length,
    completed: entries.filter((entry) => entry.status === "completed").length
  };
}

export async function listProduction() {
  return (await listEntries(PRODUCTION_PREFIX)).sort((left, right) => `${left.date}${left.title}`.localeCompare(`${right.date}${right.title}`, "ko"));
}

export async function saveProduction(input, actorId = "") {
  const id = makeId(input?.id);
  const existing = await readEntry(PRODUCTION_PREFIX, id);
  const title = cleanText(input?.title, 140);
  const date = cleanText(input?.date, 10);
  if (!title) throw new Error("PRODUCTION_TITLE_REQUIRED");
  if (!validDate(date)) throw new Error("OPERATION_DATE_INVALID");
  const shipped = Boolean(input?.shipped);
  const now = new Date().toISOString();

  return writeEntry(PRODUCTION_PREFIX, {
    id,
    tenantId: TENANT_KEY,
    title,
    date,
    drawingNumber: cleanText(input?.drawingNumber, 100),
    workers: cleanText(input?.workers, 160),
    process: PRODUCTION_PROCESSES.has(input?.process) ? input.process : "other",
    quantity: positiveNumber(input?.quantity),
    unit: cleanText(input?.unit, 20) || "개",
    shipped,
    shippedAt: shipped ? (existing?.shippedAt || now) : null,
    memo: cleanText(input?.memo, 3000),
    ...auditFields(existing, actorId)
  });
}

export async function deleteProduction(id) {
  if (!isOperationId(id)) throw new Error("OPERATION_ID_INVALID");
  await del(itemPath(PRODUCTION_PREFIX, id));
}

export function summarizeProduction(entries) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return {
    total: entries.length,
    today: entries.filter((entry) => entry.date === today).length,
    waiting: entries.filter((entry) => !entry.shipped).length,
    shipped: entries.filter((entry) => entry.shipped).length
  };
}

function normalizeInventoryPhoto(photo, itemId) {
  const path = cleanText(photo?.path, 320);
  if (!PHOTO_PATTERN.test(path) || !path.startsWith(`${INVENTORY_PHOTO_PREFIX}${itemId}/`)) return null;
  const contentType = cleanText(photo?.contentType, 50);
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) return null;
  return {
    id: cleanText(photo?.id, 80) || path.split("/").pop().split(".")[0],
    path,
    name: cleanText(photo?.name, 120) || "제품사진",
    contentType,
    size: positiveNumber(photo?.size),
    uploadedAt: cleanText(photo?.uploadedAt, 40) || new Date().toISOString()
  };
}

export async function listInventory() {
  return (await listEntries(INVENTORY_PREFIX)).sort((left, right) => left.name.localeCompare(right.name, "ko"));
}

export async function listInventoryMovements() {
  return (await listEntries(INVENTORY_MOVEMENT_PREFIX, 2000)).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function saveInventory(input, actorId = "") {
  const id = makeId(input?.id);
  const existing = await readEntry(INVENTORY_PREFIX, id);
  const name = cleanText(input?.name, 120);
  if (!name) throw new Error("INVENTORY_NAME_REQUIRED");
  const photo = input?.photo ? normalizeInventoryPhoto(input.photo, id) : null;
  const entry = {
    id,
    tenantId: TENANT_KEY,
    name,
    spec: cleanText(input?.spec, 160),
    quantity: existing ? positiveNumber(existing.quantity) : positiveNumber(input?.quantity),
    unit: cleanText(input?.unit, 20) || "개",
    location: cleanText(input?.location, 120),
    photo,
    memo: cleanText(input?.memo, 2000),
    ...auditFields(existing, actorId)
  };
  await writeEntry(INVENTORY_PREFIX, entry);
  if (existing?.photo?.path && existing.photo.path !== photo?.path && isInventoryPhotoPath(existing.photo.path)) {
    await del(existing.photo.path);
  }
  return entry;
}

export async function moveInventory(input, actorId = "") {
  const itemId = cleanText(input?.itemId, 80);
  const item = await readEntry(INVENTORY_PREFIX, itemId);
  if (!item) throw new Error("INVENTORY_NOT_FOUND");
  const type = MOVEMENT_TYPES.has(input?.type) ? input.type : "";
  const quantity = positiveNumber(input?.quantity);
  if (!type || quantity <= 0) throw new Error("INVENTORY_MOVEMENT_INVALID");
  if (type === "out" && quantity > positiveNumber(item.quantity)) throw new Error("INVENTORY_QUANTITY_SHORT");

  const nextQuantity = type === "in" ? positiveNumber(item.quantity) + quantity : positiveNumber(item.quantity) - quantity;
  const movement = {
    id: randomUUID(),
    tenantId: TENANT_KEY,
    itemId,
    itemName: item.name,
    type,
    quantity,
    unit: item.unit,
    previousQuantity: positiveNumber(item.quantity),
    nextQuantity,
    note: cleanText(input?.note, 500),
    createdAt: new Date().toISOString(),
    createdBy: cleanText(actorId, 40)
  };

  await writeEntry(INVENTORY_MOVEMENT_PREFIX, movement);
  await writeEntry(INVENTORY_PREFIX, {
    ...item,
    quantity: nextQuantity,
    updatedAt: movement.createdAt,
    updatedBy: cleanText(actorId, 40)
  });
  return { item: { ...item, quantity: nextQuantity, updatedAt: movement.createdAt, updatedBy: cleanText(actorId, 40) }, movement };
}

export async function deleteInventory(id) {
  if (!isOperationId(id)) throw new Error("OPERATION_ID_INVALID");
  const item = await readEntry(INVENTORY_PREFIX, id);
  const movements = (await listInventoryMovements()).filter((movement) => movement.itemId === id);
  const paths = [itemPath(INVENTORY_PREFIX, id), ...movements.map((movement) => itemPath(INVENTORY_MOVEMENT_PREFIX, movement.id))];
  if (item?.photo?.path && isInventoryPhotoPath(item.photo.path)) paths.push(item.photo.path);
  await del(paths);
}

export function summarizeInventory(items, movements) {
  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 7);
  return {
    items: items.length,
    totalQuantity: items.reduce((sum, item) => sum + positiveNumber(item.quantity), 0),
    monthIn: movements.filter((movement) => movement.type === "in" && movement.createdAt.startsWith(currentMonth)).length,
    monthOut: movements.filter((movement) => movement.type === "out" && movement.createdAt.startsWith(currentMonth)).length
  };
}
