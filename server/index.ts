/**
 * Production HTTP server (replaces react-router-serve). Same static asset and
 * logging behaviour, plus: request URLs are rebuilt from APP_URL so actions work
 * behind TLS-terminating reverse proxies (see app/server/public-origin.server.ts).
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import type { ServerBuild } from "react-router";
import { appUrl } from "~/server/env.server";
import { forwardedHeadersFor, originMismatchWarning, parsePublicOrigin } from "~/server/public-origin.server";

const port = Number(process.env.PORT ?? 3000);
const publicOrigin = parsePublicOrigin(appUrl());
const forwarded = forwardedHeadersFor(publicOrigin);
const build = (await import(pathToFileURL(path.resolve("build/server/index.js")).href)) as ServerBuild;
const clientDir = path.resolve("build/client");

const app = express();
app.disable("x-powered-by");
// Forwarding headers are overwritten below, so trusting them is safe.
app.set("trust proxy", true);
app.use(compression());
app.use("/assets", express.static(path.join(clientDir, "assets"), { immutable: true, maxAge: "1y" }));
app.use(express.static(clientDir, { maxAge: "1h" }));
app.use(morgan("tiny"));

let lastWarning = 0;
app.use((req, _res, next) => {
  Object.assign(req.headers, forwarded);
  const warning = originMismatchWarning(req.method, req.get("origin"), publicOrigin);
  if (warning && Date.now() - lastWarning > 60_000) {
    lastWarning = Date.now();
    console.warn(`[openscore] ${warning}`);
  }
  next();
});

app.all("/{*splat}", createRequestHandler({ build, mode: process.env.NODE_ENV }));

const server = app.listen(port, process.env.HOST ?? "0.0.0.0", () => {
  console.info(`[openscore] listening on :${port}; public URL ${publicOrigin.origin}`);
});
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => server.close((err) => err && console.error(err)));
}
