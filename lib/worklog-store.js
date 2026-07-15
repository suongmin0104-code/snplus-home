import { randomUUID } from "node:crypto";

import { del, get, list, put } from "@vercel/blob";

export const WORKLOG_ENTRY_PREFIX = "admin-worklog/entries/";
export const WORKLOG_PHOTO_PREFIX = "admin-worklog/photos/";

const ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const STATUS_VALUES = new Set(["planned", "progress", "completed"]);
const CATEGORY_VALUES = new Set(["field", "delivery", "inspection", "office", "other"]);
const PHOTO_PATTERN = /^admin-worklog\/photos\/[A-Za-z0-9_-]{8,80}\/[A-Za-z0-9-]+\.(?:jpg|png|webp)$/;

function cleanText(value, maximumLength) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximumLength);
}

function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function entryPath(id) {
  return `${WORKLOG_ENTRY_PREFIX}${id}.json`;
}

async function streamToText(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function normalizePhoto(photo, entryId) {
  const path = cleanText(photo?.path, 300);
  if (!PHOTO_PATTERN.test(path) || !path.startsWith(`${WORKLOG_PHOTO_PREFIX}${entryId}/`)) {
    return null;
  }

  const contentType = cleanText(photo?.contentType, 50);
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return null;
  }

  return {
    id: cleanText(photo?.id, 80) || path.split("/").pop().split(".")[0],
    path,
    name: cleanText(photo?.name, 120) || "현장사진",
    contentType,
    size: Number.isFinite(Number(photo?.size)) ? Math.max(0, Math.round(Number(photo.size))) : 0,
    uploadedAt: cleanText(photo?.uploadedAt, 40) || new Date().toISOString()
  };
}

export function normalizeWorklog(input, existing = null, actorId = "") {
  const proposedId = cleanText(input?.id, 80);
  const id = ID_PATTERN.test(proposedId) ? proposedId : randomUUID();
  const title = cleanText(input?.title, 120);
  const date = cleanText(input?.date, 10);

  if (!title) {
    throw new Error("WORKLOG_TITLE_REQUIRED");
  }
  if (!validDate(date)) {
    throw new Error("WORKLOG_DATE_INVALID");
  }

  const startTime = cleanText(input?.startTime, 5);
  const endTime = cleanText(input?.endTime, 5);
  const now = new Date().toISOString();
  const photos = Array.isArray(input?.photos)
    ? input.photos.map((photo) => normalizePhoto(photo, id)).filter(Boolean).slice(0, 6)
    : [];

  return {
    id,
    title,
    date,
    startTime: TIME_PATTERN.test(startTime) ? startTime : "",
    endTime: TIME_PATTERN.test(endTime) ? endTime : "",
    status: STATUS_VALUES.has(input?.status) ? input.status : "planned",
    category: CATEGORY_VALUES.has(input?.category) ? input.category : "field",
    site: cleanText(input?.site, 160),
    workers: cleanText(input?.workers, 200),
    description: cleanText(input?.description, 5000),
    photos,
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || actorId,
    updatedAt: now,
    updatedBy: actorId
  };
}

export function isWorklogId(value) {
  return ID_PATTERN.test(String(value ?? ""));
}

export function isWorklogPhotoPath(value) {
  return PHOTO_PATTERN.test(String(value ?? ""));
}

export async function readWorklog(id) {
  if (!isWorklogId(id)) return null;
  const result = await get(entryPath(id), { access: "private", useCache: false });
  if (!result?.stream) return null;

  try {
    return JSON.parse(await streamToText(result.stream));
  } catch {
    return null;
  }
}

export async function listWorklogs() {
  const blobs = [];
  let cursor;

  do {
    const result = await list({ prefix: WORKLOG_ENTRY_PREFIX, limit: 250, cursor });
    blobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor && blobs.length < 1000);

  const entries = await Promise.all(
    blobs.slice(0, 1000).map(async (blob) => {
      const id = blob.pathname.slice(WORKLOG_ENTRY_PREFIX.length).replace(/\.json$/, "");
      return readWorklog(id);
    })
  );

  return entries
    .filter(Boolean)
    .sort((left, right) => `${left.date} ${left.startTime}`.localeCompare(`${right.date} ${right.startTime}`, "ko"));
}

export async function saveWorklog(input, actorId = "") {
  const requestedId = cleanText(input?.id, 80);
  const existing = isWorklogId(requestedId) ? await readWorklog(requestedId) : null;
  const entry = normalizeWorklog(input, existing, actorId);

  await put(entryPath(entry.id), JSON.stringify(entry), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60
  });

  const retainedPaths = new Set(entry.photos.map((photo) => photo.path));
  const removedPaths = (existing?.photos ?? [])
    .map((photo) => photo.path)
    .filter((path) => isWorklogPhotoPath(path) && !retainedPaths.has(path));
  if (removedPaths.length) {
    await del(removedPaths);
  }

  return entry;
}

export async function deleteWorklog(id) {
  if (!isWorklogId(id)) {
    throw new Error("WORKLOG_ID_INVALID");
  }

  const existing = await readWorklog(id);
  const paths = [entryPath(id), ...(existing?.photos ?? []).map((photo) => photo.path).filter(isWorklogPhotoPath)];
  await del(paths);
}

export function summarizeWorklogs(entries, today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })) {
  const active = entries.filter((entry) => entry.status !== "completed");
  const todayEntries = entries.filter((entry) => entry.date === today);
  const overdue = active.filter((entry) => entry.date < today);
  const completed = entries.filter((entry) => entry.status === "completed");

  return {
    total: entries.length,
    active: active.length,
    today: todayEntries.length,
    overdue: overdue.length,
    completed: completed.length
  };
}
