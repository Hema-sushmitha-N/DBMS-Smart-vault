import { getUser } from "../../../../lib/auth.mjs";
import { json } from "../../../../lib/http.mjs";
export async function GET() {
  const user = await getUser();
  return json({ user }, user ? 200 : 401);
}
