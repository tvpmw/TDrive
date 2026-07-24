import { pgTable, varchar, text, integer, timestamp, index, unique, foreignKey } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const deletionJobs = pgTable(
  "deletion_jobs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    remoteId: varchar("remote_id", { length: 512 }).notNull(),
    status: varchar("status", { length: 32 }).default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_deletion_jobs_user_id").on(table.userId),
    unique("uq_deletion_jobs_user_remote").on(table.userId, table.remoteId),
    foreignKey({ columns: [table.userId], foreignColumns: [users.id] }),
  ]
);
