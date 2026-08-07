import { z } from "zod/v4";

const envSchema = z.object({
  DATABASE_URL: z.url().default("postgresql://postgres:postgres@localhost:5432/tdrive"),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(32).default("dev-jwt-secret-change-in-production-32+"),
  ENCRYPTION_KEY: z.string().min(32).default("dev-encryption-key-change-in-prod-32+"),
  TELEGRAM_API_ID: z.string().optional().default(""),
  TELEGRAM_API_HASH: z.string().optional().default(""),
  TELEGRAM_SESSION: z.string().optional().default(""),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TDRIVE_STORAGE_CHANNEL: z.string().default("TeleDrive Storage"),
  APP_URL: z.string().default("http://localhost:3000"),
  TDRIVE_MAX_UPLOAD_BYTES: z.coerce.number().default(Number.MAX_SAFE_INTEGER),
  TDRIVE_MAX_ARCHIVE_BYTES: z.coerce.number().default(Number.MAX_SAFE_INTEGER),
  TDRIVE_MAX_EDITOR_BYTES: z.coerce.number().default(5_242_880),
  SERVER_FILES_MODE: z.enum(["local", "sftp"]).default("local"),
  SERVER_FILES_ROOT: z.string().default("./server-files"),
  API_PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
