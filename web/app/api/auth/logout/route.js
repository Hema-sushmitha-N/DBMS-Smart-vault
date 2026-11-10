import { clearSession } from "../../../../lib/auth.mjs";
import { body, json, fail } from "../../../../lib/http.mjs";
export async function POST(request) {
  try {
    await body(request);
    await clearSession();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
