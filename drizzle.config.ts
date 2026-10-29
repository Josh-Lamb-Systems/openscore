import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env");
} catch {
  // use the real environment
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./app/server/schema.server.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
