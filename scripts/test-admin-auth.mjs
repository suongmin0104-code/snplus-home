import assert from "node:assert/strict";

import {
  createRootOwner,
  createSessionToken,
  hasAdminPermission,
  verifySessionToken
} from "../lib/admin-auth.js";
import {
  hashAdminSecret,
  normalizePhoneId,
  passwordMeetsPolicy,
  verifyAdminSecret
} from "../lib/admin-user-store.js";

const password = "SecurePass123";
const hash = hashAdminSecret(password);
assert.equal(verifyAdminSecret(password, hash), true);
assert.equal(verifyAdminSecret("WrongPass123", hash), false);
assert.equal(normalizePhoneId("010-1234-5678"), "01012345678");
assert.equal(passwordMeetsPolicy(password, "01012345678"), true);
assert.equal(passwordMeetsPolicy("1234567890", "01012345678"), false);

const sessionSecret = "1234567890123456789012345678901234567890";
const token = createSessionToken("01012345678", sessionSecret, 1_000_000);
assert.equal(verifySessionToken(token, sessionSecret, 1_000_001)?.sub, "01012345678");

const owner = createRootOwner({
  username: "01000000000",
  passwordHash: hash,
  sessionSecret
});
assert.equal(owner.role, "owner");
assert.equal(hasAdminPermission(owner, "users.manage"), true);

console.log("Admin authentication helper checks passed.");
