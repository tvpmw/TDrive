import { pgTable, varchar, integer, timestamp, index, foreignKey, text } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { driveItems } from "./drive-items.js";

export const storageChannels = pgTable(
  "storage_channels",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    channelId: varchar("channel_id", { length: 255 }).notNull(),
    channelName: varchar("channel_name", { length: 255 }).notNull(),
    isActive: integer("is_active").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_storage_channels_user_id").on(table.userId),
    foreignKey({ columns: [table.userId], foreignColumns: [users.id] }),
  ]
);

export const itemChunkManifests = pgTable(
  "item_chunk_manifests",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    itemId: varchar("item_id", { length: 64 }).notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    channelId: varchar("channel_id", { length: 255 }).notNull(),
    telegramMessageId: varchar("telegram_message_id", { length: 255 }).notNull(),
    chunkHash: varchar("chunk_hash", { length: 128 }),
    isParity: integer("is_parity").default(0).notNull(), // 0 = data, 1 = parity (Reed-Solomon)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_chunk_manifests_item_id").on(table.itemId),
    foreignKey({ columns: [table.itemId], foreignColumns: [driveItems.id] }),
  ]
);

export const shareAnalytics = pgTable(
  "share_analytics",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    shareToken: varchar("share_token", { length: 64 }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    country: varchar("country", { length: 64 }),
    bytesSent: integer("bytes_sent").default(0).notNull(),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_share_analytics_token").on(table.shareToken),
  ]
);

export const fileRevisions = pgTable(
  "file_revisions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    itemId: varchar("item_id", { length: 64 }).notNull(),
    revisionNumber: integer("revision_number").notNull(),
    size: integer("size").notNull(),
    telegramMessageId: varchar("telegram_message_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 64 }).notNull(),
  },
  (table) => [
    index("idx_file_revisions_item_id").on(table.itemId),
    foreignKey({ columns: [table.itemId], foreignColumns: [driveItems.id] }),
  ]
);

export const timeCapsules = pgTable(
  "time_capsules",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    itemId: varchar("item_id", { length: 64 }).notNull(),
    unlockAt: timestamp("unlock_at", { withTimezone: true }).notNull(),
    beneficiaryEmail: varchar("beneficiary_email", { length: 255 }),
    isUnlocked: integer("is_unlocked").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_time_capsules_user_id").on(table.userId),
    foreignKey({ columns: [table.userId], foreignColumns: [users.id] }),
  ]
);

export const automationRules = pgTable(
  "automation_rules",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    triggerEvent: varchar("trigger_event", { length: 64 }).notNull(), // e.g. "file.uploaded"
    actionType: varchar("action_type", { length: 64 }).notNull(), // e.g. "webhook" | "ai_summarize"
    targetUrl: text("target_url"),
    isActive: integer("is_active").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_automation_rules_user_id").on(table.userId),
    foreignKey({ columns: [table.userId], foreignColumns: [users.id] }),
  ]
);

export const telegramAccounts = pgTable(
  "telegram_accounts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    sessionName: varchar("session_name", { length: 255 }).notNull(),
    sessionString: text("session_string"),
    dcId: integer("dc_id").default(2).notNull(),
    healthScore: integer("health_score").default(5).notNull(), // 1 to 5 stars
    latencyMs: integer("latency_ms").default(120).notNull(),
    floodwaitUntil: timestamp("floodwait_until", { withTimezone: true }),
    isMaintenance: integer("is_maintenance").default(0).notNull(), // 0 = false, 1 = true
    usageBytes: integer("usage_bytes").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_tg_accounts_user_id").on(table.userId),
  ]
);

export const telegramOperationsLog = pgTable(
  "telegram_operations_log",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    accountId: varchar("account_id", { length: 64 }),
    channelId: varchar("channel_id", { length: 255 }),
    topicId: varchar("topic_id", { length: 255 }),
    messageId: varchar("message_id", { length: 255 }),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_tg_ops_log_event_type").on(table.eventType),
  ]
);

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    query: text("query").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_saved_searches_user_id").on(table.userId),
  ]
);

export const fileRelations = pgTable(
  "file_relations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    parentItemId: varchar("parent_item_id", { length: 64 }).notNull(),
    childItemId: varchar("child_item_id", { length: 64 }).notNull(),
    relationType: varchar("relation_type", { length: 64 }).default("attachment").notNull(), // "subtitle" | "poster" | "attachment"
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_file_relations_parent").on(table.parentItemId),
  ]
);



