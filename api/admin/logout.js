import { clearSessionCookie, sendJson } from "../../lib/admin-auth.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, message: "Method Not Allowed" });
  }

  clearSessionCookie(res);
  return sendJson(res, 200, { ok: true, authenticated: false });
}
