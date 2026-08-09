import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  isContactLeadId,
  isContactPhotoPath,
  summarizeContactInquiries
} from "../lib/contact-store.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function read(path) {
  return readFile(join(root, path), "utf8");
}

const [
  html,
  client,
  contactApi,
  adminApi,
  photoApi,
  store,
  vercel,
  vite
] = await Promise.all([
  read("inquiries.html"),
  read("inquiries.js"),
  read("api/contact.js"),
  read("api/admin/inquiries.js"),
  read("api/admin/inquiry-photo.js"),
  read("lib/contact-store.js"),
  read("vercel.json"),
  read("vite.config.mjs")
]);

assert.match(html, /noindex, nofollow, noarchive/);
assert.match(html, /data-inquiry-list/);
assert.match(html, /type="module" src="\/inquiries\.js"/);
assert.match(client, /\/api\/admin\/inquiries/);
assert.match(client, /\/api\/admin\/inquiry-photo\?path=/);
assert.match(contactApi, /saveInquiry\(inquiry/);
assert.match(contactApi, /stored: Boolean\(storedEntry\)/);
assert.match(contactApi, /notified: mailSent/);
assert.match(adminApi, /requireAdmin\(req, res, "estimate"\)/);
assert.match(photoApi, /requireAdmin\(req, res, "estimate"\)/);
assert.match(store, /access: "private"/);
assert.match(store, /contact-inquiries\/entries\//);
assert.match(vercel, /"source": "\/admin\/inquiries"/);
assert.match(vite, /inquiries: fileURLToPath/);

assert.equal(isContactLeadId("SN-20260809-A1B2C3D4"), true);
assert.equal(isContactLeadId("../../secret"), false);
assert.equal(
  isContactPhotoPath("contact-inquiries/photos/SN-20260809-A1B2C3D4/01-site-photo.jpg"),
  true
);
assert.equal(isContactPhotoPath("contact-inquiries/photos/../../secret"), false);

const summary = summarizeContactInquiries([
  { status: "new", notification: { status: "not_configured" } },
  { status: "contacted", notification: { status: "sent" } },
  { status: "quoted", notification: { status: "failed" } }
]);
assert.deepEqual(summary, {
  total: 3,
  new: 1,
  contacted: 1,
  quoted: 1,
  closed: 0,
  spam: 0,
  mailPending: 2
});

console.log("contact inbox tests passed");
