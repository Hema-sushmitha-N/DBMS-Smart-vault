import * as lancedb from "@lancedb/lancedb";
import { query } from "./db.mjs";
const NAME = "inventory_patterns";
const state = (globalThis.__svVector ??= {});
export const featureNames = [
  "Stock coverage",
  "Issue share",
  "Receipt volume",
  "Transfer share",
  "Turnover",
  "Activity",
];
export function patternVector(row) {
  const q = Number(row.quantity),
    r = Number(row.reorder_level),
    received = Number(row.received),
    issued = Number(row.issued),
    transferred = Number(row.transferred),
    n = Number(row.movement_count);
  return [
    q / (q + r + 1),
    issued / (received + issued + 1),
    received / (received + 100),
    transferred / (received + issued + transferred + 1),
    issued / (issued + q + 1),
    (n + 1) / (n + 11),
  ];
}
async function db() {
  if (!state.connection)
    state.connection = await lancedb.connect(
      process.env.VECTOR_DB_PATH || "../.local/vectors",
    );
  return state.connection;
}
async function open() {
  const c = await db();
  try {
    return await c.openTable(NAME);
  } catch (e) {
    if (!(await c.tableNames()).includes(NAME))
      throw Object.assign(
        Error(
          "Patterns are not initialized. Ask an Admin to refresh patterns.",
        ),
        { status: 409 },
      );
    throw e;
  }
}
function record(row, note = "") {
  return {
    id: row.product_id + ":" + row.warehouse_id,
    product_id: Number(row.product_id),
    warehouse_id: Number(row.warehouse_id),
    product_name: row.product_name,
    warehouse_name: row.warehouse_name,
    quantity: Number(row.quantity),
    reorder_level: Number(row.reorder_level),
    vector: patternVector(row),
    note,
    updated_at: new Date().toISOString(),
  };
}
export function validPatternId(id) {
  if (!/^[1-9]\d*:[1-9]\d*$/.test(id))
    throw Object.assign(Error("Select a valid inventory pattern."), {
      status: 400,
    });
  return id;
}
let queue = Promise.resolve();
export async function syncPatterns(role = "ADMIN") {
  const work = async () => {
    const source = (
      await query(
        role,
        "SELECT * FROM smartvault.v_pattern_features ORDER BY product_id,warehouse_id",
      )
    ).rows;
    if (!source.length) return { count: 0 };
    const c = await db();
    const names = await c.tableNames();
    let table,
      notes = new Map();
    if (names.includes(NAME)) {
      table = await c.openTable(NAME);
      for (const r of await table.query().select(["id", "note"]).toArray())
        notes.set(r.id, r.note);
    }
    const records = source.map((r) =>
      record(r, notes.get(r.product_id + ":" + r.warehouse_id) || ""),
    );
    if (!table) table = await c.createTable(NAME, records);
    else {
      await table
        .mergeInsert("id")
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute(records);
      await table.delete(
        "id NOT IN (" + records.map((r) => "'" + r.id + "'").join(",") + ")",
      );
    }
    return { count: records.length };
  };
  const result = queue.then(work, work);
  queue = result.catch(() => {});
  return result;
}
export async function listPatterns() {
  const table = await open();
  const rows = await table.query().toArray();
  return rows
    .map((r) => ({ ...r, vector: Array.from(r.vector || []) }))
    .sort(
      (a, b) => a.product_id - b.product_id || a.warehouse_id - b.warehouse_id,
    );
}
export async function similarPatterns(id) {
  validPatternId(id);
  const table = await open();
  const source = (
    await table
      .query()
      .where("id = '" + id + "'")
      .toArray()
  )[0];
  if (!source)
    throw Object.assign(
      Error("Pattern not found. Refresh patterns to restore it."),
      { status: 404 },
    );
  const rows = await table
    .vectorSearch(Array.from(source.vector))
    .distanceType("cosine")
    .where("id != '" + id + "'")
    .limit(6)
    .toArray();
  return {
    source: { ...source, vector: Array.from(source.vector) },
    matches: rows.map((r) => ({
      ...r,
      vector: Array.from(r.vector),
      similarity: Math.max(0, Math.min(1, 1 - r._distance)),
    })),
    features: featureNames,
  };
}
export async function updatePattern(id, note) {
  validPatternId(id);
  const table = await open();
  if (
    !(
      await table
        .query()
        .where("id = '" + id + "'")
        .toArray()
    ).length
  )
    throw Object.assign(Error("Pattern not found."), { status: 404 });
  await table.update({
    where: "id = '" + id + "'",
    values: { note, updated_at: new Date().toISOString() },
  });
}
export async function deletePattern(id) {
  validPatternId(id);
  await (await open()).delete("id = '" + id + "'");
}
export async function upsertPattern(id) {
  validPatternId(id);
  const [p, w] = id.split(":").map(Number);
  const rows = (
    await query(
      "ADMIN",
      "SELECT * FROM smartvault.v_pattern_features WHERE product_id=$1 AND warehouse_id=$2",
      [p, w],
    )
  ).rows;
  if (!rows.length)
    throw Object.assign(Error("Inventory record not found."), { status: 404 });
  const table = await open();
  await table
    .mergeInsert("id")
    .whenMatchedUpdateAll()
    .whenNotMatchedInsertAll()
    .execute([record(rows[0])]);
}
