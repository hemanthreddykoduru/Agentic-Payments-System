// CockroachDB v25.4+ creates tables with schema_locked = true, which speeds up
// changefeeds but blocks Prisma's DDL — it creates tables first, then indexes, and
// the second step hits the lock on tables it just made.
//
// Run this between a failed `prisma db push`/`migrate dev` and the retry.
// npm run db:unlock
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(
  "select table_name from information_schema.tables where table_schema = 'public'",
);
for (const { table_name } of rows) {
  await client.query(`ALTER TABLE "${table_name}" SET (schema_locked = false)`);
}

console.log(`unlocked ${rows.length} tables`);
await client.end();
