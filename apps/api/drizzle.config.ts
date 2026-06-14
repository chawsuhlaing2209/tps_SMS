import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load env from the API folder first, then the repo root, so credentials in
// the root .env are picked up whether run from apps/api or the workspace root.
config();
config({ path: "../../.env" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://sms:sms@localhost:5432/sms"
  }
});
