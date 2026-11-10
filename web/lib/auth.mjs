import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { query } from "./db.mjs";
const COOKIE = "smartvault_session";
function key() {
  if (!process.env.SESSION_SECRET) throw Error("Session secret not configured");
  return new TextEncoder().encode(process.env.SESSION_SECRET);
}
export async function issueSession(user) {
  const token = await new SignJWT({ uid: user.user_id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("smartvault")
    .setAudience("smartvault-web")
    .setExpirationTime("8h")
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.APP_ORIGIN?.startsWith("https:"),
    path: "/",
    maxAge: 8 * 3600,
  });
}
export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
export async function getUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: "smartvault",
      audience: "smartvault-web",
    });
    const r = await query(
      "AUTH",
      "SELECT * FROM smartvault.get_session_user($1)",
      [payload.uid],
    );
    return r.rows[0] || null;
  } catch {
    return null;
  }
}
export async function requireUser(admin = false) {
  const u = await getUser();
  if (!u)
    throw Object.assign(Error("Please sign in to continue."), { status: 401 });
  if (admin && u.role !== "ADMIN")
    throw Object.assign(Error("Admin access is required."), { status: 403 });
  return u;
}
