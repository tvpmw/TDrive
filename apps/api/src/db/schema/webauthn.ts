import { pgTable, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";

export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  credentialId: varchar("credential_id", { length: 1024 }).notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").default(0).notNull(),
  transports: text("transports").default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const webauthnChallenges = pgTable("webauthn_challenges", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  challenge: text("challenge").notNull(),
  kind: varchar("kind", { length: 32 }).default("registration").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
