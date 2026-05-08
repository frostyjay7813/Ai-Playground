import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/ai_playground";

export const db = new Pool({ connectionString });
