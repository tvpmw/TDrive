import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@localhost:5432/tdrive");

async function main() {
  console.log("Applying migration...");
  await sql`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS telegram_storage_mode VARCHAR(64) DEFAULT 'supergroup' NOT NULL,
    ADD COLUMN IF NOT EXISTS telegram_storage_channel_name VARCHAR(255);
  `;
  console.log("SUCCESS: Columns telegram_storage_mode and telegram_storage_channel_name added!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
