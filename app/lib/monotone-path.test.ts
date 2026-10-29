import { describe, expect, it } from "vitest";
import { monotonePath } from "./monotone-path";

/** Samples a cubic Bézier path string ("M… C… C…") and returns all y values. */
function sampleYs(d: string): number[] {
  const nums = d.match(/-?\d+(\.\d+)?(e-?\d+)?/g)!.map(Number);
  let [x0, y0] = nums.slice(0, 2);
  const ys: number[] = [y0];
  for (let i = 2; i + 5 < nums.length + 1; i += 6) {
    const [, c1y, , c2y, x3, y3] = nums.slice(i, i + 6);
    for (let t = 0; t <= 1; t += 0.05) {
      const u = 1 - t;
      ys.push(u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y3);
    }
    [x0, y0] = [x3, y3];
  }
  void x0;
  return ys;
}

describe("monotonePath", () => {
  it("passes through every point", () => {
    const pts = [
      { x: 0, y: 50 },
      { x: 100, y: 60 },
      { x: 200, y: 180 },
      { x: 300, y: 40 },
    ];
    const d = monotonePath(pts);
    expect(d.startsWith("M0,50")).toBe(true);
    for (const p of pts.slice(1)) expect(d).toContain(` ${p.x},${p.y}`);
  });

  it("never overshoots the data range", () => {
    const pts = [
      { x: 0, y: 40 },
      { x: 100, y: 45 },
      { x: 200, y: 190 },
      { x: 300, y: 50 },
      { x: 400, y: 30 },
    ];
    const ys = sampleYs(monotonePath(pts));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(30 - 1e-9);
    expect(Math.max(...ys)).toBeLessThanOrEqual(190 + 1e-9);
  });

  it("keeps flat segments flat and handles tiny inputs", () => {
    const ys = sampleYs(monotonePath([{ x: 0, y: 10 }, { x: 50, y: 10 }, { x: 100, y: 10 }]));
    expect(new Set(ys.map((y) => Math.round(y * 1e6)))).toEqual(new Set([10_000_000]));
    expect(monotonePath([])).toBe("");
    expect(monotonePath([{ x: 1, y: 2 }])).toBe("M1,2");
  });
});
