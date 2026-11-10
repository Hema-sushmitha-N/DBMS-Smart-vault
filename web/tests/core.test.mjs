import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../lib/passwords.mjs";
import { patternVector, validPatternId } from "../lib/vector.mjs";
test("password hashes are salted, verify correctly, and reject wrong credentials", async () => {
  const a = await hashPassword("TestPassword!123"),
    b = await hashPassword("TestPassword!123");
  assert.notEqual(a, b);
  assert.ok(await verifyPassword("TestPassword!123", a));
  assert.equal(await verifyPassword("wrong", a), false);
  assert.equal(await verifyPassword("wrong", "scrypt$bad$01"), false);
});
test("operational vectors stay bounded and zero-stock positions remain searchable", () => {
  for (const row of [
    {
      quantity: 0,
      reorder_level: 10,
      received: 0,
      issued: 0,
      transferred: 0,
      movement_count: 0,
    },
    {
      quantity: 40,
      reorder_level: 20,
      received: 100,
      issued: 60,
      transferred: 0,
      movement_count: 2,
    },
  ]) {
    const vector = patternVector(row);
    assert.equal(vector.length, 6);
    assert.ok(vector.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
    assert.ok(vector.reduce((a, v) => a + v * v, 0) > 0);
  }
});
test("pattern identifiers reject SQL fragments and malformed values", () => {
  assert.equal(validPatternId("1:2"), "1:2");
  for (const value of ["1:2' OR true --", "0:1", "-1:2", "abc"])
    assert.throws(() => validPatternId(value));
});
