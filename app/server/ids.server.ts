import { randomBytes } from "node:crypto";
import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const short = customAlphabet(alphabet, 16);

/** Primary keys for app tables, e.g. `sc_k3j2…`. */
export function createId(prefix: string): string {
  return `${prefix}_${short()}`;
}

/** URL-safe, unguessable token (≥128 bits) for result links and invites. */
export function createToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
