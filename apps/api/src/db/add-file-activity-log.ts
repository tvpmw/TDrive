// Migration: buat tabel file_activity_log untuk timeline aktivitas per file
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS file_activity_log (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      item_id VARCHAR(64) NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      message TEXT NOT NULL,
      meta JSONB,
      created_at TIMESTAMPTZ DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_file_activity_item_id ON file_activity_log (item_id);
    CREATE INDEX IF NOT EXISTS idx_file_activity_user_id ON file_activity_log (user_id);
  `);
  console.log("✅ file_activity_log table ready");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
