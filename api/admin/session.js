import {
  getAdminConfig,
  getSessionFromRequest,
  isAdminConfigured,
  sendJson
} from "../../lib/admin-auth.js";

export default function handler(req, res) {
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
  const authenticated = Boolean(session && session.sub === config.username);
  return sendJson(res, 200, {
    ok: true,
    configured: true,
    authenticated,
    user: authenticated ? { name: config.username } : null,
    expiresAt: authenticated ? new Date(session.exp * 1000).toISOString() : null
  });
}
