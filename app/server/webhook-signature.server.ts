import { createHmac, timingSafeEqual } from "node:crypto";

/** `t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>` */
export function signPayload(secret: string, timestamp: number, body: string): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

/**
 * Reference verifier (mirrors what receivers should do). Rejects signatures
 * older than `toleranceSeconds` to prevent replays.
 */
export function verifySignature(
  secret: string,
  header: string,
  body: string,
  { now = Date.now(), toleranceSeconds = 300 } = {},
): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return false;
  if (Math.abs(now / 1000 - t) > toleranceSeconds) return false;
  const expected = Buffer.from(signPayload(secret, t, body).split("v1=")[1], "hex");
  const given = Buffer.from(parts.v1, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
