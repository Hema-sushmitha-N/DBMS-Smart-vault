// Genuine LanceDB commands used by the application.
// Run from web/ after npm run setup. Demonstration changes are restored.
import * as lancedb from "@lancedb/lancedb";
import { syncPatterns, listPatterns } from "../lib/vector.mjs";
import { poolFor } from "../lib/db.mjs";
process.loadEnvFile(".env.local");
await syncPatterns("ADMIN");
const db = await lancedb.connect(process.env.VECTOR_DB_PATH);
const table = await db.openTable("inventory_patterns");
console.log(
  "READ",
  await table
    .query()
    .select(["id", "product_name", "warehouse_name", "quantity"])
    .limit(3)
    .toArray(),
);
const original = (await listPatterns()).find((r) => r.id === "1:1");
const row = { ...original, vector: Array.from(original.vector) };
console.log(
  "SEARCH",
  await table
    .vectorSearch(row.vector)
    .distanceType("cosine")
    .where("id != '1:1'")
    .limit(3)
    .toArray(),
);
await table.update({
  where: "id = '1:1'",
  values: { note: "CRUD demonstration" },
});
console.log(
  "UPDATE",
  await table.query().where("id = '1:1'").select(["id", "note"]).toArray(),
);
await table.delete("id = '1:1'");
console.log("DELETE", await table.query().where("id = '1:1'").toArray());
await table
  .mergeInsert("id")
  .whenMatchedUpdateAll()
  .whenNotMatchedInsertAll()
  .execute([row]);
console.log("CREATE / UPSERT: original record restored");
await poolFor("ADMIN").end();
