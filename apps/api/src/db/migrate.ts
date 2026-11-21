// Apply versioned Drizzle migrations to the configured database.
import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadEnv } from "../config/env.js";
import { createDatabase } from "./client.js";

const env = loadEnv();
if (!env.DATABASE_URL)
  throw new Error("DATABASE_URL is required to run migrations.");
const { pool, db } = createDatabase(env.DATABASE_URL);
try {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
