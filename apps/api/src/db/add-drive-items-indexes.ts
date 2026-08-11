import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@localhost:5432/tdrive");

async function main() {
  console.log("Adding hot-query indexes for drive_items...");
  await sql`CREATE INDEX IF NOT EXISTS idx_drive_items_user_parent ON drive_items (user_id, parent_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_drive_items_user_deleted ON drive_items (user_id, deleted_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_drive_items_file_hash ON drive_items (file_hash)`;
  console.log("SUCCESS: idx_drive_items_user_parent, idx_drive_items_user_deleted, idx_drive_items_file_hash created!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
