import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { hashPassword } from "../lib/passwords.mjs";
const root = path.resolve("..");
const cfg = JSON.parse(
  await fs.readFile(path.join(root, ".local/connection.json"), "utf8"),
);
const bin = path.join(root, ".tools/pgsql/bin");
let ready = spawnSync(
  path.join(bin, "pg_isready.exe"),
  ["-h", cfg.host, "-p", String(cfg.port)],
  { stdio: "ignore", windowsHide: true },
);
if (ready.status !== 0) {
  const log = await fs.open(path.join(root, ".local/startup.log"), "a");
  const started = spawnSync(
    path.join(bin, "pg_ctl.exe"),
    [
      "-D",
      path.join(root, ".local/postgres-data"),
      "-l",
      path.join(root, ".local/postgres.log"),
      "-w",
      "start",
    ],
    { stdio: ["ignore", log.fd, log.fd], windowsHide: true },
  );
  await log.close();
  if (started.status !== 0) throw Error("PostgreSQL could not start");
}
const db = new pg.Client({
  host: cfg.host,
  port: cfg.port,
  user: cfg.username,
  password: cfg.password,
  database: cfg.database,
});
await db.connect();
let local;
try {
  local = JSON.parse(
    await fs.readFile(path.join(root, ".local/app_credentials.json"), "utf8"),
  );
} catch {
  local = {
    adminPassword: crypto.randomBytes(24).toString("hex"),
    staffPassword: crypto.randomBytes(24).toString("hex"),
    authPassword: crypto.randomBytes(24).toString("hex"),
    secret: crypto.randomBytes(48).toString("hex"),
    demoAdminPassword: "VaultAdmin!2026",
    demoStaffPassword: "VaultStaff!2026",
  };
  await fs.writeFile(
    path.join(root, ".local/app_credentials.json"),
    JSON.stringify(local, null, 2),
  );
}
const migration = await fs.readFile(
  path.join(root, "06_application_security.sql"),
  "utf8",
);
await db.query(migration);
for (const [role, password] of [
  ["smartvault_admin", local.adminPassword],
  ["smartvault_staff", local.staffPassword],
  ["smartvault_auth", local.authPassword],
]) {
  await db.query(
    "ALTER ROLE " +
      role +
      " WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '" +
      password +
      "'",
  );
  await db.query("GRANT CONNECT ON DATABASE smartvault TO " + role);
}
for (const [email, password] of [
  ["asha@smartvault.example", local.demoAdminPassword],
  ["ravi@smartvault.example", local.demoStaffPassword],
  ["neha@smartvault.example", local.demoStaffPassword],
]) {
  const found = await db.query(
    "SELECT password_hash FROM smartvault.app_users WHERE email=$1",
    [email],
  );
  if (!found.rows[0]?.password_hash)
    await db.query(
      "UPDATE smartvault.app_users SET password_hash=$1 WHERE email=$2",
      [await hashPassword(password), email],
    );
}
const env = {
  DB_HOST: cfg.host,
  DB_PORT: cfg.port,
  DB_NAME: cfg.database,
  DB_ADMIN_USER: "smartvault_admin",
  DB_ADMIN_PASSWORD: local.adminPassword,
  DB_STAFF_USER: "smartvault_staff",
  DB_STAFF_PASSWORD: local.staffPassword,
  DB_AUTH_USER: "smartvault_auth",
  DB_AUTH_PASSWORD: local.authPassword,
  SESSION_SECRET: local.secret,
  APP_ORIGIN: "http://127.0.0.1:3080",
  VECTOR_DB_PATH: "../.local/vectors",
};
await fs.writeFile(
  ".env.local",
  Object.entries(env)
    .map(([k, v]) => k + "=" + v)
    .join("\n") + "\n",
);
const dump = spawnSync(
  path.join(bin, "pg_dump.exe"),
  [
    "-h",
    cfg.host,
    "-p",
    String(cfg.port),
    "-U",
    cfg.username,
    "-d",
    cfg.database,
    "-n",
    "smartvault",
    "--schema-only",
    "--no-owner",
    "--file",
    path.join(root, "report/implemented_schema.sql"),
  ],
  {
    env: { ...process.env, PGPASSWORD: cfg.password },
    windowsHide: true,
    encoding: "utf8",
  },
);
if (dump.status !== 0)
  console.error("Schema export will be retried during report generation.");
await db.end();
process.loadEnvFile(".env.local");
const { syncPatterns } = await import("../lib/vector.mjs");
const { poolFor } = await import("../lib/db.mjs");
await syncPatterns("ADMIN");
await poolFor("ADMIN").end();
console.log(
  "PostgreSQL migration, restricted roles, hashed demo accounts, and private application configuration are ready.",
);
