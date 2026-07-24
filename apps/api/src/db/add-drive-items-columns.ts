import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@localhost:5432/tdrive");

async function main() {
  console.log("Applying columns migration for drive_items...");
  await sql`
    ALTER TABLE drive_items 
    ADD COLUMN IF NOT EXISTS is_starred INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS tags VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS collections VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS uploader_email VARCHAR(320);
  `;
  console.log("SUCCESS: Columns is_starred, tags, collections, and uploader_email added!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
