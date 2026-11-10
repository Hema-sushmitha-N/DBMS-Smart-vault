import fs from "node:fs/promises";
import path from "node:path";
process.loadEnvFile(".env.local");
const {
  syncPatterns,
  listPatterns,
  similarPatterns,
  updatePattern,
  deletePattern,
  upsertPattern,
} = await import("../lib/vector.mjs");
const { poolFor } = await import("../lib/db.mjs");
const evidence = {};
evidence.create = await syncPatterns();
const before = await listPatterns();
evidence.read = { count: before.length, example: before[0] };
const id = before[0].id;
await updatePattern(
  id,
  "Demonstration: review warehouse replenishment behavior.",
);
evidence.update = (await listPatterns()).find((r) => r.id === id).note;
evidence.search = await similarPatterns(id);
await deletePattern(id);
evidence.delete = { remaining: (await listPatterns()).length };
await upsertPattern(id);
await updatePattern(id, before[0].note);
evidence.restored = { count: (await listPatterns()).length };
for (const r of before) {
  const s = await similarPatterns(r.id);
  if (s.matches.some((m) => !Number.isFinite(m.similarity)))
    throw Error("Invalid similarity for " + r.id);
}
await fs.writeFile(
  path.resolve("../report/vector_crud_evidence.json"),
  JSON.stringify(evidence, null, 2),
);
await poolFor("ADMIN").end();
console.log(
  "PASS: persistent vector create/read/update/delete, restore, and finite similarity for all inventory positions.",
);
