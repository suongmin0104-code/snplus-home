import { randomUUID } from "node:crypto";

import { BlobPreconditionFailedError, del, get, list, put } from "@vercel/blob";

const TENANT_KEY = "snplus";
const ROOT_PREFIX = `admin-tax/${TENANT_KEY}/`;
export const TAX_TRANSACTION_PREFIX = `${ROOT_PREFIX}transactions/`;
export const TAX_TASK_PREFIX = `${ROOT_PREFIX}tasks/`;
export const TAX_FORECAST_PREFIX = `${ROOT_PREFIX}forecasts/`;

const ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const TRANSACTION_DIRECTIONS = new Set(["income", "expense"]);
const EVIDENCE_STATUSES = new Set(["attached", "missing", "not-required"]);
const FORECAST_REVIEW_STATUSES = new Set(["estimate", "advisor-reviewed"]);

function cleanText(value, maximumLength) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximumLength);
}

function cleanAmount(value) {
  const amount = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function makeId(value) {
  const proposed = cleanText(value, 80);
  return ID_PATTERN.test(proposed) ? proposed : randomUUID();
}

function entryPath(prefix, id) {
  return `${prefix}${id}.json`;
}

function forecastId(month) {
  return `forecast-${month}`;
}

async function streamToText(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function readEntryResult(prefix, id) {
  if (!ID_PATTERN.test(String(id ?? ""))) return null;
  const result = await get(entryPath(prefix, id), { access: "private", useCache: false });
  if (!result?.stream) return null;
  try {
    return {
      entry: JSON.parse(await streamToText(result.stream)),
      etag: cleanText(result.blob?.etag, 160)
    };
  } catch {
    return null;
  }
}

async function readEntry(prefix, id) {
  return (await readEntryResult(prefix, id))?.entry || null;
}

async function listEntries(prefix, limit = 1500) {
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
  await put(entryPath(prefix, entry.id), JSON.stringify(entry), {
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

export function seoulDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

export function isTaxRecordId(value) {
  return ID_PATTERN.test(String(value ?? ""));
}

export async function listTaxTransactions() {
  return (await listEntries(TAX_TRANSACTION_PREFIX)).sort((left, right) => {
    return `${right.date}${right.updatedAt}`.localeCompare(`${left.date}${left.updatedAt}`);
  });
}

export async function saveTaxTransaction(input, actorId = "") {
  const id = makeId(input?.id);
  const existing = await readEntry(TAX_TRANSACTION_PREFIX, id);
  const date = cleanText(input?.date, 10);
  const direction = TRANSACTION_DIRECTIONS.has(input?.direction) ? input.direction : "";
  const amount = cleanAmount(input?.amount);
  const category = cleanText(input?.category, 80);
  if (!validDate(date)) throw new Error("TAX_DATE_INVALID");
  if (!direction) throw new Error("TAX_DIRECTION_INVALID");
  if (!category) throw new Error("TAX_CATEGORY_REQUIRED");
  if (amount <= 0) throw new Error("TAX_AMOUNT_INVALID");

  return writeEntry(TAX_TRANSACTION_PREFIX, {
    id,
    tenantId: TENANT_KEY,
    date,
    direction,
    category,
    clientName: cleanText(input?.clientName, 120),
    amount,
    evidenceStatus: EVIDENCE_STATUSES.has(input?.evidenceStatus) ? input.evidenceStatus : "missing",
    memo: cleanText(input?.memo, 2000),
    ...auditFields(existing, actorId)
  });
}

export async function deleteTaxTransaction(id) {
  if (!isTaxRecordId(id)) throw new Error("TAX_RECORD_ID_INVALID");
  await del(entryPath(TAX_TRANSACTION_PREFIX, id));
}

export async function listTaxTasks() {
  return (await listEntries(TAX_TASK_PREFIX)).sort((left, right) => {
    if (Boolean(left.done) !== Boolean(right.done)) return left.done ? 1 : -1;
    return `${left.dueDate}${left.title}`.localeCompare(`${right.dueDate}${right.title}`, "ko");
  });
}

export async function saveTaxTask(input, actorId = "") {
  const id = makeId(input?.id);
  const existing = await readEntry(TAX_TASK_PREFIX, id);
  const dueDate = cleanText(input?.dueDate, 10);
  const title = cleanText(input?.title, 140);
  const done = Boolean(input?.done);
  if (!validDate(dueDate)) throw new Error("TAX_DATE_INVALID");
  if (!title) throw new Error("TAX_TASK_TITLE_REQUIRED");

  return writeEntry(TAX_TASK_PREFIX, {
    id,
    tenantId: TENANT_KEY,
    title,
    dueDate,
    taskType: cleanText(input?.taskType, 80) || "기타",
    ownerName: cleanText(input?.ownerName, 60),
    memo: cleanText(input?.memo, 2000),
    done,
    completedAt: done ? (existing?.completedAt || new Date().toISOString()) : null,
    ...auditFields(existing, actorId)
  });
}

export async function deleteTaxTask(id) {
  if (!isTaxRecordId(id)) throw new Error("TAX_RECORD_ID_INVALID");
  await del(entryPath(TAX_TASK_PREFIX, id));
}

export async function readTaxForecast(month) {
  const selectedMonth = cleanText(month, 7);
  if (!MONTH_PATTERN.test(selectedMonth)) throw new Error("TAX_MONTH_INVALID");
  const result = await readEntryResult(TAX_FORECAST_PREFIX, forecastId(selectedMonth));
  return result ? { ...result.entry, version: result.etag } : null;
}

export async function saveTaxForecast(input, actorId = "") {
  const month = cleanText(input?.month, 7);
  if (!MONTH_PATTERN.test(month)) throw new Error("TAX_MONTH_INVALID");

  const id = forecastId(month);
  const current = await readEntryResult(TAX_FORECAST_PREFIX, id);
  const existing = current?.entry || null;
  const expectedVersion = cleanText(input?.expectedVersion, 160);
  if ((current && current.etag !== expectedVersion) || (!current && expectedVersion)) {
    throw new Error("TAX_FORECAST_CONFLICT");
  }
  const forecast = {
    id,
    tenantId: TENANT_KEY,
    month,
    vatAmount: cleanAmount(input?.vatAmount),
    withholdingAmount: cleanAmount(input?.withholdingAmount),
    corporateTaxAmount: cleanAmount(input?.corporateTaxAmount),
    otherTaxAmount: cleanAmount(input?.otherTaxAmount),
    reviewStatus: FORECAST_REVIEW_STATUSES.has(input?.reviewStatus) ? input.reviewStatus : "estimate",
    memo: cleanText(input?.memo, 2000),
    ...auditFields(existing, actorId)
  };
  forecast.totalAmount = forecast.vatAmount
    + forecast.withholdingAmount
    + forecast.corporateTaxAmount
    + forecast.otherTaxAmount;
  try {
    const blob = await put(entryPath(TAX_FORECAST_PREFIX, forecast.id), JSON.stringify(forecast), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: Boolean(current),
      ...(current?.etag ? { ifMatch: current.etag } : {}),
      contentType: "application/json",
      cacheControlMaxAge: 60
    });
    return { ...forecast, version: cleanText(blob?.etag, 160) };
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) throw new Error("TAX_FORECAST_CONFLICT");
    if (!current && await readEntryResult(TAX_FORECAST_PREFIX, id)) throw new Error("TAX_FORECAST_CONFLICT");
    throw error;
  }
}

export function summarizeTaxForecast(forecast, month = "") {
  const selectedMonth = MONTH_PATTERN.test(String(month ?? ""))
    ? String(month)
    : (MONTH_PATTERN.test(String(forecast?.month ?? "")) ? String(forecast.month) : "");
  const summary = {
    month: selectedMonth,
    saved: Boolean(forecast?.id || forecast?.updatedAt),
    version: cleanText(forecast?.version, 160),
    vatAmount: cleanAmount(forecast?.vatAmount),
    withholdingAmount: cleanAmount(forecast?.withholdingAmount),
    corporateTaxAmount: cleanAmount(forecast?.corporateTaxAmount),
    otherTaxAmount: cleanAmount(forecast?.otherTaxAmount),
    reviewStatus: FORECAST_REVIEW_STATUSES.has(forecast?.reviewStatus) ? forecast.reviewStatus : "estimate",
    memo: cleanText(forecast?.memo, 2000),
    updatedAt: cleanText(forecast?.updatedAt, 40),
    updatedBy: cleanText(forecast?.updatedBy, 40)
  };
  summary.totalAmount = summary.vatAmount
    + summary.withholdingAmount
    + summary.corporateTaxAmount
    + summary.otherTaxAmount;
  summary.hasValues = summary.totalAmount > 0 || Boolean(summary.memo);
  return summary;
}

export function summarizeTaxWorkspace(transactions = [], tasks = [], month = "", today = seoulDateKey()) {
  const selectedMonth = /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const monthTransactions = transactions.filter((entry) => String(entry.date || "").startsWith(selectedMonth));
  const income = monthTransactions
    .filter((entry) => entry.direction === "income")
    .reduce((sum, entry) => sum + cleanAmount(entry.amount), 0);
  const expense = monthTransactions
    .filter((entry) => entry.direction === "expense")
    .reduce((sum, entry) => sum + cleanAmount(entry.amount), 0);
  const missingEvidence = transactions.filter((entry) => entry.evidenceStatus === "missing").length;
  const pendingTasks = tasks.filter((entry) => !entry.done);
  const overdueTasks = pendingTasks.filter((entry) => validDate(entry.dueDate) && entry.dueDate < today).length;

  return {
    month: selectedMonth,
    income,
    expense,
    balance: income - expense,
    transactionCount: monthTransactions.length,
    missingEvidence,
    pendingTasks: pendingTasks.length,
    overdueTasks
  };
}
