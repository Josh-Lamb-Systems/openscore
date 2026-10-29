/**
 * Dev helper for visual QA: signs in and screenshots app pages.
 *   npx tsx scripts/screenshot.ts /scorecards /tmp/shot.png [width] [height]
 * Uses SHOT_EMAIL / SHOT_PASSWORD (default admin@example.com / password123) and APP_URL.
 */
import { chromium } from "playwright";

const [path = "/scorecards", out = "/tmp/shot.png", w = "1440", h = "900"] = process.argv.slice(2);
const base = process.env.APP_URL ?? "http://localhost:5173";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
if (!path.startsWith("/s/") && !path.startsWith("/embed/")) {
  await page.goto(`${base}/login`);
  if (page.url().includes("/login")) {
    await page.fill("#email", process.env.SHOT_EMAIL ?? "admin@example.com");
    await page.fill("#password", process.env.SHOT_PASSWORD ?? "password123");
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[value=password]")]);
  }
}
await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: process.env.FULL === "1" });
console.log(`saved ${out} (${page.url()})`);
await browser.close();
