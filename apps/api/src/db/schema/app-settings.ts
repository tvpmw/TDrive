import { pgTable, varchar, boolean } from "drizzle-orm/pg-core";

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  boolValue: boolean("bool_value"),
});
