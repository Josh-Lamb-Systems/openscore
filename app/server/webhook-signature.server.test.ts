import { describe, expect, it } from "vitest";
import { signPayload, verifySignature } from "./webhook-signature.server";

describe("webhook signatures", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ event: "ping" });
  const now = 1_800_000_000_000;
  const t = now / 1000;

  it("produces a stable t=…,v1=… header", () => {
    expect(signPayload(secret, t, body)).toMatch(/^t=1800000000,v1=[0-9a-f]{64}$/);
    expect(signPayload(secret, t, body)).toBe(signPayload(secret, t, body));
  });

  it("verifies its own signatures", () => {
    expect(verifySignature(secret, signPayload(secret, t, body), body, { now })).toBe(true);
  });

  it("rejects tampering, wrong secrets and stale timestamps", () => {
    const header = signPayload(secret, t, body);
    expect(verifySignature(secret, header, body + " ", { now })).toBe(false);
    expect(verifySignature("other", header, body, { now })).toBe(false);
    expect(verifySignature(secret, header, body, { now: now + 301_000 })).toBe(false);
    expect(verifySignature(secret, "garbage", body, { now })).toBe(false);
  });
});
