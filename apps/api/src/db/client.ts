// A single PostgreSQL pool shared by the application.
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
/** Create the pool and typed Drizzle client. No connection is opened until a query runs. */
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
  });
  return { pool, db: drizzle(pool, { schema }) };
}
