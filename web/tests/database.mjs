import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
process.loadEnvFile(".env.local");
const { poolFor } = await import("../lib/db.mjs");
const { reports } = await import("../lib/reports.mjs");
const evidence = { roles: {}, queries: [] };
for (const role of ["ADMIN", "STAFF"]) {
  const pool = poolFor(role);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const counts = await c.query(
      "SELECT COUNT(*)::int AS rows,SUM(quantity)::int AS units FROM smartvault.inventory",
    );
    evidence.roles[role] = { ...counts.rows[0] };
    assert.equal(counts.rows[0].units, 343);
    if (role === "STAFF") {
      for (const sql of [
        "INSERT INTO smartvault.categories(category_name) VALUES('Forbidden')",
        "UPDATE smartvault.inventory SET quantity=999 WHERE product_id=1 AND warehouse_id=1",
        "SELECT password_hash FROM smartvault.app_users",
      ]) {
        await c.query("SAVEPOINT denied");
        await assert.rejects(c.query(sql), (e) => e.code === "42501");
        await c.query("ROLLBACK TO SAVEPOINT denied");
      }
      evidence.roles.STAFF.denied = [
        "master writes",
        "direct balance writes",
        "password hash reads",
      ];
    }
    const actor = role === "ADMIN" ? 1 : 2;
    await c.query("SELECT smartvault.record_movement(1,1,2,$1,3,$2,$3)", [
      "TRANSFER",
      actor,
      "Integration check",
    ]);
    let rows = (
      await c.query(
        "SELECT quantity FROM smartvault.inventory WHERE product_id=1 AND warehouse_id IN(1,2) ORDER BY warehouse_id",
      )
    ).rows;
    assert.deepEqual(
      rows.map((r) => r.quantity),
      [22, 20],
    );
    await c.query("SAVEPOINT failed_transfer");
    await assert.rejects(
      c.query("SELECT smartvault.record_movement(1,1,2,$1,99999,$2,$3)", [
        "TRANSFER",
        actor,
        "Rejected check",
      ]),
    );
    await c.query("ROLLBACK TO SAVEPOINT failed_transfer");
    rows = (
      await c.query(
        "SELECT quantity FROM smartvault.inventory WHERE product_id=1 AND warehouse_id IN(1,2) ORDER BY warehouse_id",
      )
    ).rows;
    assert.deepEqual(
      rows.map((r) => r.quantity),
      [22, 20],
    );
    evidence.roles[role].atomic_transfer = "passed";
    if (role === "ADMIN") {
      const order = (
        await c.query(
          "SELECT smartvault.create_purchase_order(1,1,1,$1) AS id",
          [JSON.stringify([{ product_id: 2, quantity: 5, unit_cost: 800 }])],
        )
      ).rows[0].id;
      await c.query("SELECT smartvault.receive_purchase_order($1,1)", [order]);
      assert.equal(
        (
          await c.query(
            "SELECT quantity FROM smartvault.inventory WHERE product_id=2 AND warehouse_id=1",
          )
        ).rows[0].quantity,
        13,
      );
      assert.equal(
        (
          await c.query(
            "SELECT status FROM smartvault.low_stock_alerts WHERE product_id=2 AND warehouse_id=1",
          )
        ).rows[0].status,
        "RESOLVED",
      );
      await c.query("SAVEPOINT duplicate_receipt");
      await assert.rejects(
        c.query("SELECT smartvault.receive_purchase_order($1,1)", [order]),
      );
      await c.query("ROLLBACK TO SAVEPOINT duplicate_receipt");
      evidence.roles.ADMIN.receiving = "passed; duplicate receiving rejected";
      await c.query(
        "INSERT INTO smartvault.categories(category_name,parent_category_id) VALUES('Cycle check',1)",
      );
      const child = (
        await c.query(
          "SELECT category_id FROM smartvault.categories WHERE category_name='Cycle check'",
        )
      ).rows[0].category_id;
      await c.query("SAVEPOINT category_cycle");
      await assert.rejects(
        c.query(
          "UPDATE smartvault.categories SET parent_category_id=$1 WHERE category_id=1",
          [child],
        ),
      );
      await c.query("ROLLBACK TO SAVEPOINT category_cycle");
      evidence.roles.ADMIN.category_cycle = "rejected";
    }
    await c.query("ROLLBACK");
  } finally {
    c.release();
  }
}
for (const report of reports) {
  const r = await poolFor("ADMIN").query(report.sql);
  evidence.queries.push({ id: report.id, title: report.title, rows: r.rows });
  if (report.id === "ledger") assert.equal(r.rows.length, 0);
}
await fs.writeFile(
  path.resolve("../report/database_test_evidence.json"),
  JSON.stringify(evidence, null, 2),
);
await Promise.all(["ADMIN", "STAFF"].map((r) => poolFor(r).end()));
console.log(
  "PASS: Admin/Staff SQL permissions, atomic transfers, receiving, duplicate-receipt prevention, recursive-cycle validation, and all report queries. Test changes rolled back.",
);
