import { describe, expect, it } from "vitest";
import { forwardedHeadersFor, originMismatchWarning, parsePublicOrigin } from "./public-origin.server";

describe("public origin", () => {
  const origin = parsePublicOrigin("https://scores.example.com/");

  it("parses APP_URL", () => {
    expect(origin).toEqual({ protocol: "https", host: "scores.example.com", origin: "https://scores.example.com" });
    expect(parsePublicOrigin("http://localhost:3000").host).toBe("localhost:3000");
    expect(() => parsePublicOrigin("ftp://x")).toThrow(/http/);
  });

  it("forces forwarding headers to the public origin", () => {
    expect(forwardedHeadersFor(origin)).toEqual({ "x-forwarded-proto": "https", "x-forwarded-host": "scores.example.com" });
  });

  it("explains mismatched origins on mutating requests only", () => {
    expect(originMismatchWarning("POST", "https://scores.example.com", origin)).toBeNull();
    expect(originMismatchWarning("GET", "https://evil.example", origin)).toBeNull();
    expect(originMismatchWarning("POST", undefined, origin)).toBeNull();
    expect(originMismatchWarning("POST", "http://10.0.0.5:3000", origin)).toMatch(/APP_URL=http:\/\/10\.0\.0\.5:3000/);
  });
});
