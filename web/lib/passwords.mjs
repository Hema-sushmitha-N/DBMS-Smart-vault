import { scrypt as rawScrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(rawScrypt);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const key = await scrypt(password, salt, 64);
  return "scrypt$" + salt + "$" + key.toString("hex");
}
export async function verifyPassword(password, encoded) {
  if (!encoded) return false;
  const [scheme, salt, hex] = encoded.split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  if (expected.length !== 64) return false;
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, expected);
}
