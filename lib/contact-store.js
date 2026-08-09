import { del, get, list, put } from "@vercel/blob";

export const CONTACT_ENTRY_PREFIX = "contact-inquiries/entries/";
export const CONTACT_PHOTO_PREFIX = "contact-inquiries/photos/";
export const CONTACT_STATUS_VALUES = Object.freeze(["new", "contacted", "quoted", "closed", "spam"]);

const LEAD_ID_PATTERN = /^SN-\d{8}-[A-F0-9]{8}$/;
const PHOTO_PATH_PATTERN = /^contact-inquiries\/photos\/SN-\d{8}-[A-F0-9]{8}\/\d{2}-[A-Za-z0-9._-]{1,100}$/;
const NOTIFICATION_VALUES = new Set(["pending", "sent", "not_configured", "failed", "skipped"]);
const STATUS_VALUES = new Set(CONTACT_STATUS_VALUES);
const PHOTO_EXTENSIONS = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
});

function cleanText(value, maximumLength = 500) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximumLength);
}

function entryPath(leadId) {
  return `${CONTACT_ENTRY_PREFIX}${leadId}.json`;
}

function safePhotoName(contentType, index) {
  const extension = PHOTO_EXTENSIONS[contentType] || "jpg";
  return `${String(index + 1).padStart(2, "0")}-site-photo.${extension}`;
}

async function streamToText(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function normalizeNotification(value = {}) {
  const status = NOTIFICATION_VALUES.has(value?.status) ? value.status : "pending";
  return {
    status,
    updatedAt: cleanText(value?.updatedAt, 40) || new Date().toISOString(),
    errorCode: cleanText(value?.errorCode, 80),
    provider: cleanText(value?.provider, 40) || "resend"
  };
}

function normalizeStoredPhoto(photo, leadId) {
  const path = cleanText(photo?.path, 300);
  if (!PHOTO_PATH_PATTERN.test(path) || !path.startsWith(`${CONTACT_PHOTO_PREFIX}${leadId}/`)) return null;
  const contentType = cleanText(photo?.contentType, 50);
  if (!PHOTO_EXTENSIONS[contentType]) return null;
  return {
    path,
    name: cleanText(photo?.name, 120) || "현장사진",
    contentType,
    size: Number.isFinite(Number(photo?.size)) ? Math.max(0, Math.round(Number(photo.size))) : 0
  };
}

async function writeContactInquiry(entry) {
  await put(entryPath(entry.leadId), JSON.stringify(entry), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60
  });
  return entry;
}

export function isContactLeadId(value) {
  return LEAD_ID_PATTERN.test(String(value ?? ""));
}

export function isContactPhotoPath(value) {
  return PHOTO_PATH_PATTERN.test(String(value ?? ""));
}

export async function saveContactInquiry(inquiry, notification = { status: "pending" }) {
  if (!isContactLeadId(inquiry?.leadId)) throw new Error("CONTACT_LEAD_ID_INVALID");

  const uploadedPaths = [];
  const storedPhotos = [];
  const now = new Date().toISOString();

  try {
    for (const [index, photo] of (inquiry.photos ?? []).entries()) {
      const photoName = safePhotoName(photo.contentType, index);
      const path = `${CONTACT_PHOTO_PREFIX}${inquiry.leadId}/${photoName}`;
      const body = Buffer.from(photo.content, "base64");
      await put(path, body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: photo.contentType,
        cacheControlMaxAge: 3600
      });
      uploadedPaths.push(path);
      storedPhotos.push({
        path,
        name: cleanText(photo.name, 120) || `현장사진 ${index + 1}`,
        contentType: photo.contentType,
        size: body.length
      });
    }

    const entry = {
      ...inquiry,
      photos: storedPhotos,
      status: "new",
      notification: normalizeNotification(notification),
      storedAt: now,
      updatedAt: now,
      statusUpdatedAt: now,
      statusUpdatedBy: "system"
    };

    return await writeContactInquiry(entry);
  } catch (error) {
    if (uploadedPaths.length) {
      try {
        await del(uploadedPaths);
      } catch (cleanupError) {
        console.error("CONTACT_STORAGE_CLEANUP_FAILED", cleanupError?.message ?? cleanupError);
      }
    }
    console.error("CONTACT_STORAGE_SAVE_FAILED", error?.message ?? error);
    throw new Error("CONTACT_STORAGE_FAILED");
  }
}

export async function readContactInquiry(leadId) {
  if (!isContactLeadId(leadId)) return null;
  const result = await get(entryPath(leadId), { access: "private", useCache: false });
  if (!result?.stream) return null;

  try {
    const entry = JSON.parse(await streamToText(result.stream));
    return {
      ...entry,
      photos: Array.isArray(entry.photos)
        ? entry.photos.map((photo) => normalizeStoredPhoto(photo, leadId)).filter(Boolean)
        : [],
      notification: normalizeNotification(entry.notification)
    };
  } catch {
    return null;
  }
}

export async function updateContactNotification(entry, notification) {
  if (!isContactLeadId(entry?.leadId)) throw new Error("CONTACT_LEAD_ID_INVALID");
  const updated = {
    ...entry,
    notification: normalizeNotification(notification),
    updatedAt: new Date().toISOString()
  };
  return writeContactInquiry(updated);
}

export async function updateContactStatus(leadId, status, actorId = "") {
  if (!isContactLeadId(leadId)) throw new Error("CONTACT_LEAD_ID_INVALID");
  if (!STATUS_VALUES.has(status)) throw new Error("CONTACT_STATUS_INVALID");

  const entry = await readContactInquiry(leadId);
  if (!entry) throw new Error("CONTACT_NOT_FOUND");

  const now = new Date().toISOString();
  return writeContactInquiry({
    ...entry,
    status,
    statusUpdatedAt: now,
    statusUpdatedBy: cleanText(actorId, 120) || "admin",
    updatedAt: now
  });
}

export async function listContactInquiries(maximumEntries = 250) {
  const limit = Math.min(Math.max(Number(maximumEntries) || 250, 1), 500);
  const blobs = [];
  let cursor;

  do {
    const result = await list({ prefix: CONTACT_ENTRY_PREFIX, limit: 250, cursor });
    blobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor && blobs.length < limit);

  const entries = await Promise.all(
    blobs.slice(0, limit).map((blob) => {
      const leadId = blob.pathname.slice(CONTACT_ENTRY_PREFIX.length).replace(/\.json$/, "");
      return readContactInquiry(leadId);
    })
  );

  return entries
    .filter(Boolean)
    .sort((left, right) => String(right.storedAt ?? "").localeCompare(String(left.storedAt ?? "")));
}

export function summarizeContactInquiries(entries) {
  const summary = {
    total: entries.length,
    new: 0,
    contacted: 0,
    quoted: 0,
    closed: 0,
    spam: 0,
    mailPending: 0
  };

  for (const entry of entries) {
    if (STATUS_VALUES.has(entry.status)) summary[entry.status] += 1;
    if (entry.notification?.status !== "sent") summary.mailPending += 1;
  }

  return summary;
}
