import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/ai_playground";

const run = async () => {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    const files = (await fs.readdir(__dirname))
      .filter((file) => /^\d+_.*\.sql$/.test(file))
      .sort();
    for (const file of files) {
      const exists = await client.query("select 1 from schema_migrations where version = $1", [file]);
      if (exists.rowCount) continue;
      const sql = await fs.readFile(path.join(__dirname, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (version) values ($1)", [file]);
        await client.query("commit");
        console.log(`Migration complete: ${file}`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
