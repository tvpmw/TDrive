import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@localhost:5432/tdrive");

async function main() {
  console.log("Applying columns migration for file_revisions...");
  await sql`
    ALTER TABLE file_revisions 
    ADD COLUMN IF NOT EXISTS storage_remote_id VARCHAR(512),
    ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(64),
    ADD COLUMN IF NOT EXISTS file_hash VARCHAR(128);
  `;
  console.log("SUCCESS: Columns storage_remote_id, storage_provider, file_hash added to file_revisions!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
