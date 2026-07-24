import { createCipheriv, createDecipheriv, randomBytes, createHmac, createHash } from "node:crypto";
import { getEnv } from "../env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptGlobal(plaintext: string): string {
  const env = getEnv();
  const key = deriveKey(env.ENCRYPTION_KEY);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptGlobal(ciphertext: string): string {
  const env = getEnv();
  const key = deriveKey(env.ENCRYPTION_KEY);
  const [ivB64, tagB64, dataB64] = ciphertext.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

function deriveUserKey(userId: string): Buffer {
  const env = getEnv();
  return createHmac("sha256", env.ENCRYPTION_KEY).update(`tdrive-manifest:${userId}`).digest();
}

export function encryptForUser(userId: string, plaintext: string): string {
  const key = deriveUserKey(userId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptForUser(userId: string, ciphertext: string): string {
  const key = deriveUserKey(userId);
  const [ivB64, tagB64, dataB64] = ciphertext.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}
