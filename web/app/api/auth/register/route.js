import { z } from "zod";
import { query } from "../../../../lib/db.mjs";
import { hashPassword } from "../../../../lib/passwords.mjs";
import { issueSession } from "../../../../lib/auth.mjs";
import { body, json, fail } from "../../../../lib/http.mjs";

const attempts = (globalThis.__svRegistrationAttempts ??= new Map());

export async function POST(request) {
  const address = request.headers.get("x-forwarded-for") || "local";
  try {
    const data = z
      .object({
        full_name: z.string().trim().min(2).max(100),
        email: z.email().max(160),
        password: z.string().min(10).max(128),
      })
      .parse(await body(request));
    const rate = attempts.get(address);
    if (rate && Date.now() - rate.at > 900000) attempts.delete(address);
    if (rate?.count >= 5)
      return json(
        { error: "Too many registration attempts. Try again in 15 minutes." },
        429,
      );
    const result = await query(
      "AUTH",
      "SELECT smartvault.register_staff_user($1,$2,$3) AS user_id",
      [
        data.full_name,
        data.email.toLowerCase(),
        await hashPassword(data.password),
      ],
    );
    attempts.delete(address);
    const user = {
      user_id: result.rows[0].user_id,
      full_name: data.full_name,
      email: data.email.toLowerCase(),
      role: "STAFF",
    };
    await issueSession(user);
    return json({ user });
  } catch (error) {
    const previous = attempts.get(address);
    attempts.set(address, {
      count: (previous?.count || 0) + 1,
      at: previous?.at || Date.now(),
    });
    return fail(error);
  }
}
