import { z } from "zod";
import { query } from "../../../../lib/db.mjs";
import { verifyPassword } from "../../../../lib/passwords.mjs";
import { issueSession } from "../../../../lib/auth.mjs";
import { body, json, fail } from "../../../../lib/http.mjs";
const attempts = (globalThis.__svAttempts ??= new Map());
export async function POST(request) {
  try {
    const b = z
      .object({
        email: z.email().max(160),
        password: z.string().min(1).max(200),
      })
      .parse(await body(request));
    const id =
      b.email.toLowerCase() +
      ":" +
      (request.headers.get("x-forwarded-for") || "local");
    let rate = attempts.get(id);
    if (rate && Date.now() - rate.at > 900000) {
      attempts.delete(id);
      rate = null;
    }
    if (rate?.count >= 10)
      return json(
        { error: "Too many attempts. Try again in 15 minutes." },
        429,
      );
    const r = await query("AUTH", "SELECT * FROM smartvault.login_record($1)", [
      b.email.toLowerCase(),
    ]);
    const u = r.rows[0];
    if (!u || !(await verifyPassword(b.password, u.password_hash))) {
      attempts.set(id, {
        count: (rate?.count || 0) + 1,
        at: rate?.at || Date.now(),
      });
      return json({ error: "Email or password is incorrect." }, 401);
    }
    attempts.delete(id);
    const { password_hash, ...user } = u;
    await issueSession(user);
    return json({ user });
  } catch (e) {
    return fail(e);
  }
}
