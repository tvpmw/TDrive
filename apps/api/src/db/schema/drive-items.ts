import { pgTable, varchar, text, integer, timestamp, index, foreignKey } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const driveItems = pgTable(
  "drive_items",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    kind: varchar("kind", { length: 16 }).notNull(), // "file" | "folder"
    name: varchar("name", { length: 512 }).notNull(),
    parentId: varchar("parent_id", { length: 64 }),
    size: integer("size").default(0).notNull(),
    mimeType: varchar("mime_type", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    storageProvider: varchar("storage_provider", { length: 64 }).default("telegram-private-channel").notNull(),
    storageRemoteId: varchar("storage_remote_id", { length: 512 }),
    storageChannelName: varchar("storage_channel_name", { length: 255 }).default("TeleDrive Storage").notNull(),
    telegramTopicId: varchar("telegram_topic_id", { length: 64 }), // For Telegram Supergroup Forum Topics
    syncStatus: varchar("sync_status", { length: 64 }).default("local").notNull(),
    syncError: varchar("sync_error", { length: 1024 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    shareToken: varchar("share_token", { length: 64 }),
    sharePasswordHash: varchar("share_password_hash", { length: 255 }),
    shareExpiresAt: timestamp("share_expires_at", { withTimezone: true }),
    downloadCount: integer("download_count").default(0).notNull(),
    isEncrypted: integer("is_encrypted").default(0).notNull(), // 0 = no, 1 = yes (E2EE)
    encryptionIv: varchar("encryption_iv", { length: 255 }),
    keySalt: varchar("key_salt", { length: 255 }),
    maxDownloads: integer("max_downloads"),
    isSelfDestruct: integer("is_self_destruct").default(0).notNull(),
    extractedText: text("extracted_text"),
    fileHash: varchar("file_hash", { length: 128 }),
    isStarred: integer("is_starred").default(0).notNull(), // 0 = no, 1 = yes
    tags: varchar("tags", { length: 1024 }), // CSV string e.g. "invoice,work,2026"
    collections: varchar("collections", { length: 1024 }), // CSV string e.g. "Anime,Kuliah,Project A"
    uploaderEmail: varchar("uploader_email", { length: 320 }),
  },
  (table) => [
    index("idx_drive_items_user_id").on(table.userId),
    index("idx_drive_items_parent_id").on(table.parentId),
    index("idx_drive_items_name").on(table.name),
    index("idx_drive_items_deleted_at").on(table.deletedAt),
    index("idx_drive_items_share_token").on(table.shareToken),
    foreignKey({ columns: [table.userId], foreignColumns: [users.id] }),
  ]
);
