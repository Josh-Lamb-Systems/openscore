/**
 * Background worker: delivers queued webhooks with retries.
 * Run with `npm run worker` (bundled to build/worker.js for production).
 */
import { pool } from "~/server/db.server";
import { deliverDue } from "~/server/webhooks.server";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 2000);
let stopping = false;

async function loop() {
  console.info(`[worker] started; polling every ${POLL_MS}ms`);
  while (!stopping) {
    try {
      const n = await deliverDue();
      if (n > 0) continue; // drain quickly while there is work
    } catch (err) {
      console.error("[worker] delivery loop error", err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await pool.end();
  console.info("[worker] stopped");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

void loop();
