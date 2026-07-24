import { pgTable, varchar, text, timestamp, index, foreignKey } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const manifestSnapshots = pgTable(
  "manifest_snapshots",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    remoteId: varchar("remote_id", { length: 512 }),
    contentEncrypted: text("content_encrypted").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_manifest_snapshots_user_id").on(table.userId),
    index("idx_manifest_snapshots_created_at").on(table.createdAt),
    foreignKey({ columns: [table.userId], foreignColumns: [users.id] }),
  ]
);
