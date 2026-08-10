import { pgTable, varchar, boolean, integer } from "drizzle-orm/pg-core";

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  boolValue: boolean("bool_value"),
  numValue: integer("num_value"),
});
