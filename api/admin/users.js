import { createRootOwner, getAdminConfig, readJsonBody, requireAdmin, sendJson } from "../../lib/admin-auth.js";
import {
  ADMIN_PERMISSION_DEFINITIONS,
  createAdminUser,
  listAdminUsers,
  normalizePhoneId,
  publicAdminUser,
  resetAdminUserActivation,
  updateAdminUser
} from "../../lib/admin-user-store.js";

function userErrorMessage(error) {
  if (error?.message === "ADMIN_USER_PHONE_INVALID") return "직원 전화번호를 정확히 입력해 주세요.";
  if (error?.message === "ADMIN_USER_NAME_REQUIRED") return "직원 이름을 입력해 주세요.";
  if (error?.message === "ADMIN_USER_EXISTS") return "이미 등록된 전화번호입니다.";
  if (error?.message === "ADMIN_USER_NOT_FOUND") return "직원 계정을 찾을 수 없습니다.";
  return "직원 계정을 처리하지 못했습니다.";
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res, "users.manage");
  if (!auth) return;

  try {
    if (req.method === "GET") {
      const rootOwner = publicAdminUser(createRootOwner(getAdminConfig()));
      const employees = (await listAdminUsers()).map(publicAdminUser);
      return sendJson(res, 200, {
        ok: true,
        users: [rootOwner, ...employees],
        permissions: ADMIN_PERMISSION_DEFINITIONS
      });
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const targetId = normalizePhoneId(body.id ?? body.phone);
      if (targetId === normalizePhoneId(getAdminConfig().username)) {
        return sendJson(res, 400, { ok: false, message: "총책임자 전화번호는 직원 계정으로 다시 등록할 수 없습니다." });
      }
      const result = body.action === "reset"
        ? await resetAdminUserActivation(targetId, auth.user.id)
        : await createAdminUser(body, auth.user.id);
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (req.method === "PATCH") {
      const body = await readJsonBody(req);
      const user = await updateAdminUser(body.id, body, auth.user.id);
      return sendJson(res, 200, { ok: true, user });
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  } catch (error) {
    console.error("ADMIN_USERS_FAILED", error?.message ?? error);
    return sendJson(res, 400, { ok: false, message: userErrorMessage(error) });
  }
}
