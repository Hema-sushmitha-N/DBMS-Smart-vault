import pg from "pg";
const { Pool } = pg;
const pools = (globalThis.__svPools ??= {});
export function poolFor(role) {
  if (!["ADMIN", "STAFF", "AUTH"].includes(role))
    throw Error("Invalid database role");
  if (!pools[role])
    pools[role] = new Pool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || "smartvault",
      user: process.env["DB_" + role + "_USER"],
      password: process.env["DB_" + role + "_PASSWORD"],
      max: 5,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 5000,
      options: "-c search_path=smartvault,public -c statement_timeout=15000",
    });
  return pools[role];
}
export async function query(role, sql, params = []) {
  return poolFor(role).query(sql, params);
}
