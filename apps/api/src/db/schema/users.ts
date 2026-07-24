import { pgTable, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  email: varchar("email", { length: 320 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isOperator: boolean("is_operator").default(false).notNull(),
  driveInitialized: boolean("drive_initialized").default(false).notNull(),
  telegramApiIdEncrypted: varchar("telegram_api_id_encrypted", { length: 1024 }),
  telegramApiHashEncrypted: varchar("telegram_api_hash_encrypted", { length: 1024 }),
  telegramSessionEncrypted: varchar("telegram_session_encrypted", { length: 4096 }),
  telegramLoginPhoneEncrypted: varchar("telegram_login_phone_encrypted", { length: 1024 }),
  telegramLoginCodeHashEncrypted: varchar("telegram_login_code_hash_encrypted", { length: 1024 }),
  telegramLoginSessionEncrypted: varchar("telegram_login_session_encrypted", { length: 4096 }),
  telegramStorageMode: varchar("telegram_storage_mode", { length: 64 }).default("supergroup").notNull(),
  telegramStorageChannelName: varchar("telegram_storage_channel_name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
