import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";
import { getEnv } from "../env.js";

const env = getEnv();
const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema });
