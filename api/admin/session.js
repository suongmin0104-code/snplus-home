import {
  getAdminConfig,
  getSessionFromRequest,
  isAdminConfigured,
  resolveSessionUser,
  sendJson
} from "../../lib/admin-auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  }

  const config = getAdminConfig();
  if (!isAdminConfigured(config)) {
    return sendJson(res, 503, {
      ok: false,
      configured: false,
      authenticated: false,
      message: "관리자 환경설정이 완료되지 않았습니다."
    });
  }

  const session = getSessionFromRequest(req, config.sessionSecret);
  let user = null;
  try {
    user = await resolveSessionUser(session, config);
  } catch (error) {
    console.error("ADMIN_SESSION_LOOKUP_FAILED", error?.message ?? error);
  }
  const authenticated = Boolean(session && user);
  return sendJson(res, 200, {
    ok: true,
    configured: true,
    authenticated,
    user: authenticated ? user : null,
    expiresAt: authenticated ? new Date(session.exp * 1000).toISOString() : null
  });
}
