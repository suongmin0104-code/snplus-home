import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import overviewHandler from "../api/admin/overview.js";
import { ADMIN_COOKIE_NAME, createSessionToken } from "../lib/admin-auth.js";

const [
  overviewSource,
  adminSource,
  worklogSource,
  operationsSource,
  taxSource,
  worklogPhotoSource,
  inventoryPhotoSource
] = await Promise.all([
  "../api/admin/overview.js",
  "../admin.js",
  "../admin-worklog.js",
  "../admin-operations.js",
  "../tax-dashboard.js",
  "../api/admin/worklog-photo.js",
  "../api/admin/inventory-photo.js"
].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

for (const forbiddenImport of [
  "listWorklogs",
  "listEstimates",
  "listProduction",
  "listInventory",
  "listInventoryMovements"
]) {
  assert.equal(
    overviewSource.includes(forbiddenImport),
    false,
    `Overview must not call Blob-backed ${forbiddenImport}.`
  );
}

assert.match(overviewSource, /summaryMode:\s*"detail-only"/);
assert.match(overviewSource, /recentEstimates:\s*\[\]/);
assert.match(overviewSource, /label:\s*allowed \? "상세 메뉴에서 확인" : "권한 없음"/);

assert.match(adminSource, /state\.currentModule === "dashboard"[\s\S]*?loadOverview\(\{ notify: true \}\)/);
assert.doesNotMatch(worklogSource, /refreshOverview/);
assert.match(worklogSource, /if \(result\.entry && state\.loaded\)/);
assert.match(worklogSource, /ignorePendingReload\(\)/);
assert.doesNotMatch(operationsSource, /closeEstimate\(\);\s*await loadEstimates\(\)/);
assert.doesNotMatch(operationsSource, /closeProduction\(\);\s*await loadProduction\(\)/);
assert.doesNotMatch(operationsSource, /closeInventory\(\);\s*await loadInventory\(\)/);
assert.match(adminSource, /onEstimateSaved:\s*\(entry\) => operations\?\.applyEstimate\(entry\)/);
assert.match(operationsSource, /applyEstimate\(entry\)[\s\S]*?estimateLoader\.invalidate\(\)/);
assert.match(taxSource, /WORKSPACE_RELOAD_STALE_MS = 5 \* 60 \* 1000/);
assert.match(taxSource, /state\.loadPromise && state\.loadingMonth === requestedMonth/);
assert.match(taxSource, /ignorePendingWorkspaceResult\(\)/);
assert.match(taxSource, /state\.loadedMonth = requestedMonth/);
assert.match(taxSource, /state\.loadedMonth === state\.month/);
assert.equal(
  (taxSource.match(/state\.lastWorkspaceLoadAt = Date\.now\(\)/g) || []).length,
  1,
  "Only a successful authoritative workspace load may refresh the workspace timestamp."
);

for (const [name, source] of [
  ["worklog photo", worklogPhotoSource],
  ["inventory photo", inventoryPhotoSource]
]) {
  assert.doesNotMatch(source, /useCache:\s*false/, `${name} reads must allow the Blob CDN cache.`);
  assert.match(source, /cacheControlMaxAge:\s*3600/, `${name} uploads must use a one-hour Blob cache.`);
  assert.match(source, /private, no-store, max-age=0/, `${name} browser responses must remain private and no-store.`);
}

process.env.ADMIN_USERNAME = "quota-test-owner";
process.env.ADMIN_PASSWORD_HASH = "scrypt$test-placeholder";
process.env.ADMIN_SESSION_SECRET = "quota-hotfix-test-secret-32-bytes-minimum";
const token = createSessionToken(process.env.ADMIN_USERNAME, process.env.ADMIN_SESSION_SECRET);
let responseBody = "";
const responseHeaders = new Map();
const response = {
  statusCode: 0,
  setHeader(name, value) {
    responseHeaders.set(String(name).toLowerCase(), value);
  },
  end(body = "") {
    responseBody = String(body);
  }
};

await overviewHandler({
  method: "GET",
  headers: { cookie: `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}` }
}, response);

assert.equal(response.statusCode, 200);
assert.match(responseHeaders.get("content-type"), /application\/json/);
const payload = JSON.parse(responseBody);
assert.equal(payload.ok, true);
assert.equal(payload.summaryMode, "detail-only");
assert.deepEqual(payload.recentEstimates, []);
for (const summary of Object.values(payload.summary)) {
  assert.deepEqual(summary, { value: null, label: "상세 메뉴에서 확인" });
}

console.log("Blob quota guard tests passed.");
