import { pgTable, varchar, integer, timestamp, index, foreignKey, text } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const botLinks = pgTable(
  "bot_links",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    telegramUserId: varchar("telegram_user_id", { length: 64 }).notNull(),
    telegramUsername: varchar("telegram_username", { length: 255 }),
    telegramFirstName: varchar("telegram_first_name", { length: 255 }),
    linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_bot_links_user_id").on(table.userId),
    index("idx_bot_links_tg_user_id").on(table.telegramUserId),
    foreignKey({ columns: [table.userId], foreignColumns: [users.id] }),
  ]
);

export const botChatStates = pgTable(
  "bot_chat_states",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    telegramUserId: varchar("telegram_user_id", { length: 64 }).notNull(),
    chatId: varchar("chat_id", { length: 64 }).notNull(),
    state: varchar("state", { length: 64 }).default("idle").notNull(), // idle | awaiting_search | awaiting_upload | browsing
    stateData: text("state_data"), // JSON for state-specific data
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_bot_chat_states_user_id").on(table.userId),
    index("idx_bot_chat_states_tg_user_id").on(table.telegramUserId),
  ]
);
