/**
 * Natural language search engine — dipakai bersama oleh:
 *  - POST /api/advanced/assistant (AI Assistant web)
 *  - Bot Telegram /ask
 */
import { db } from "../db/index.js";
import { driveItems } from "../db/schema/drive-items.js";
import { and, desc, sql } from "drizzle-orm";

export async function searchNaturalLanguage(userId: string, query: string): Promise<{ answer: string; items: any[]; explain: string[] }> {
  if (!query || !query.trim()) {
    return { answer: "Silakan tulis pertanyaan tentang file Anda.", items: [], explain: [] };
  }

  const explainParts: string[] = [];
  const conditions: ReturnType<typeof sql>[] = [
    sql`${driveItems.userId} = ${userId}`,
    sql`${driveItems.deletedAt} IS NULL`,
  ];
  const lower = query.toLowerCase().trim();

  const TYPE_EXT_MAP: Record<string, string[]> = {
    foto: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    photo: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    gambar: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    image: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    video: ["mp4", "mkv", "avi", "mov", "webm", "flv"],
    music: ["mp3", "wav", "flac", "ogg", "m4a", "aac"],
    audio: ["mp3", "wav", "flac", "ogg", "m4a", "aac"],
    document: ["pdf", "doc", "docx", "txt", "md", "xls", "xlsx", "ppt", "pptx", "json", "csv"],
    pdf: ["pdf"],
    archive: ["zip", "rar", "7z", "tar", "gz", "bz2"],
    apk: ["apk"],
  };

  // Tag filter
  const tagPattern = /(?:^|\s)(?:tag\s*[:#]?|#)([a-z0-9_-]+)/i;
  const tagMatch = lower.match(tagPattern);
  if (tagMatch) {
    const tag = tagMatch[1].toLowerCase();
    conditions.push(sql`${driveItems.tags} ILIKE ${`%${tag}%`}`);
    explainParts.push(`tag #${tag}`);
  }

  // Type filter
  for (const [typeName, exts] of Object.entries(TYPE_EXT_MAP)) {
    if (lower.includes(typeName)) {
      conditions.push(sql`LOWER(${driveItems.name}) ~ ${`(${exts.map((e) => `.${e}`).join("|")})$`}`);
      explainParts.push(`tipe ${typeName}`);
      break;
    }
  }

  // Size filter
  const sizeMatch = lower.match(/([<>])\s*(\d+)\s*(mb|gb|kb)/i);
  if (sizeMatch) {
    const op = sizeMatch[1];
    const val = parseInt(sizeMatch[2], 10);
    const unit = sizeMatch[3].toLowerCase();
    const bytes = unit === "gb" ? val * 1024 * 1024 * 1024 : unit === "mb" ? val * 1024 * 1024 : val * 1024;
    conditions.push(sql`${driveItems.size} ${sql.raw(op)} ${bytes}`);
    explainParts.push(`ukuran ${op} ${val} ${unit}`);
  }
  if (lower.includes("besar")) {
    conditions.push(sql`${driveItems.size} > ${100 * 1024 * 1024}`);
    if (!sizeMatch) explainParts.push("ukuran > 100 MB");
  }
  if (lower.includes("kecil")) {
    conditions.push(sql`${driveItems.size} < ${1024 * 1024}`);
    if (!sizeMatch) explainParts.push("ukuran < 1 MB");
  }

  // Time filter
  const now = new Date();
  if (lower.includes("hari ini") || lower.includes("today")) {
    conditions.push(sql`${driveItems.createdAt} >= ${new Date(now.getFullYear(), now.getMonth(), now.getDate())}`);
    explainParts.push("hari ini");
  }
  if (lower.includes("minggu lalu") || lower.includes("last week")) {
    conditions.push(sql`${driveItems.createdAt} >= ${new Date(now.getTime() - 7 * 86400000)}`);
    explainParts.push("minggu lalu");
  }
  if (lower.includes("bulan lalu") || lower.includes("last month")) {
    conditions.push(sql`${driveItems.createdAt} >= ${new Date(now.getTime() - 30 * 86400000)}`);
    explainParts.push("bulan lalu");
  }
  const isNewest = lower.includes("baru") || lower.includes("terbaru");
  if (isNewest) explainParts.push("terbaru");

  // Free text
  const searchText = lower
    .replace(tagPattern, "")
    .replace(/[<>]\s*\d+\s*(mb|gb|kb)/gi, "")
    .replace(/besar|kecil|hari ini|today|minggu lalu|last week|bulan lalu|last month|baru|terbaru|foto|photo|gambar|image|video|music|audio|document|pdf|archive|apk/gi, "")
    .replace(/[^a-z0-9\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (searchText) {
    conditions.push(sql`(LOWER(${driveItems.name}) LIKE ${`%${searchText}%`} OR LOWER(${driveItems.extractedText}) LIKE ${`%${searchText}%`})`);
    explainParts.push(`"${searchText}"`);
  }

  const items = await db.select().from(driveItems)
    .where(and(...conditions))
    .orderBy(desc(driveItems.createdAt))
    .limit(20);

  const rows = items as any[];
  const totalSize = rows.reduce((s: number, r: any) => s + (r.size || 0), 0);

  let answer = `🔍 Ditemukan **${rows.length} file** ${explainParts.length > 0 ? `(${explainParts.join(", ")})` : ""}.`;
  if (rows.length > 0) {
    const top = rows.slice(0, 5).map((r: any, i: number) => {
      const icon = r.kind === "folder" ? "📂" : "📄";
      const sizeStr = r.size ? `(${(r.size / 1024 / 1024).toFixed(1)} MB)` : "";
      return `${i + 1}. ${icon} **${r.name}** ${sizeStr}`;
    }).join("\n");
    answer += `\n\n${top}`;
    if (rows.length > 5) answer += `\n…dan ${rows.length - 5} lainnya.`;
    answer += `\n\n💾 Total: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  return { answer, items: rows, explain: explainParts };
}
