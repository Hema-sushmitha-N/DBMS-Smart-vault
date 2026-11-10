import { query } from "../../../lib/db.mjs";
import { json } from "../../../lib/http.mjs";
export async function GET() {
  try {
    await query("AUTH", "SELECT 1");
    return json({ application: "SmartVault", database: "connected" });
  } catch {
    return json({ application: "SmartVault", database: "unavailable" }, 503);
  }
}
