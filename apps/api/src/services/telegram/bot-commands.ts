/**
 * Telegram Bot command handlers.
 * Each user has their own bot instance.
 */
import { type Bot, Context, InlineKeyboard } from "grammy";
import { db } from "../../db/index.js";
import { driveItems } from "../../db/schema/drive-items.js";
import { users } from "../../db/schema/users.js";
import { botLinks } from "../../db/schema/bot.js";
import { eq, and, isNull, ilike, desc, sql } from "drizzle-orm";
import { linkTelegramUser, getUserByTelegramId, setChatState, getChatState, clearChatState } from "./bot-manager.js";
import { downloadFile, uploadFile } from "./storage.js";
import { searchNaturalLanguage } from "../nl-search.js";
import { getClient, findChannel, getForumTopics } from "./client.js";
import { decryptGlobal } from "../../lib/crypto.js";
import { getEnv } from "../../env.js";
import { InputFile } from "grammy";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { nanoid } from "nanoid";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function formatDuration(ms: number): string {
  const parts: string[] = [];
  const d = Math.floor(ms / 86400000); if (d > 0) { parts.push(d + "h"); ms -= d * 86400000; }
  const h = Math.floor(ms / 3600000); if (h > 0) { parts.push(h + "j"); ms -= h * 3600000; }
  const m = Math.floor(ms / 60000); if (m > 0) { parts.push(m + "m"); ms -= m * 60000; }
  const s = Math.floor(ms / 1000); if (s > 0) parts.push(s + "d");
  return parts.join(" ") || "sebentar";
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "🖼";
  if (["mp4", "avi", "mkv", "mov"].includes(ext)) return "🎬";
  if (["mp3", "wav", "flac", "ogg"].includes(ext)) return "🎵";
  if (["zip", "rar", "7z", "tar"].includes(ext)) return "📦";
  if (["pdf"].includes(ext)) return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx"].includes(ext)) return "📊";
  if (["js", "ts", "py", "go"].includes(ext)) return "💻";
  return "📁";
}

// Simpan snippet teks sebagai file .txt di folder Inbox user
async function saveSnippet(tdriveUserId: string, text: string) {
  const TEMP_DIR = resolve("./storage-temp");
  await mkdir(TEMP_DIR, { recursive: true });

  // Pastikan folder Inbox ada
  let [inbox] = await db.select().from(driveItems).where(
    and(eq(driveItems.userId, tdriveUserId), eq(driveItems.kind, "folder"), eq(driveItems.name, "Inbox"), isNull(driveItems.parentId), isNull(driveItems.deletedAt))
  ).limit(1);
  if (!inbox) {
    const inboxId = nanoid(16);
    await db.insert(driveItems).values({ id: inboxId, userId: tdriveUserId, kind: "folder", name: "Inbox", size: 0 });
    [inbox] = await db.select().from(driveItems).where(eq(driveItems.id, inboxId)).limit(1);
  }

  const buf = Buffer.from(text, "utf-8");
  const name = `snippet-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.txt`;
  const fileUuid = nanoid(20);
  await writeFile(join(TEMP_DIR, fileUuid), buf);
  const { createHash } = await import("node:crypto");
  const fileHash = createHash("sha256").update(buf).digest("hex");

  await db.insert(driveItems).values({
    id: nanoid(16),
    userId: tdriveUserId,
    kind: "file",
    name,
    parentId: inbox.id,
    size: buf.length,
    mimeType: "text/plain",
    storageRemoteId: `local://${fileUuid}`,
    storageProvider: "local",
    syncStatus: "local",
    fileHash,
  });
}

export function registerBotCommands(bot: Bot, tdriveUserId: string) {
  const env = getEnv();

  const DENY_MSG = "Perintah ditolak, anda tidak memiliki hak akses ke bot ini.";

  // Authorization check: linked user OR in allowed IDs list. Sends denial message if unauthorized.
  async function requireAuth(ctx: Context): Promise<boolean> {
    const tgUserId = String(ctx.from?.id ?? "");
    if (!tgUserId) { await ctx.reply(DENY_MSG); return false; }
    // Check if linked
    const linkedUserId = await getUserByTelegramId(tgUserId);
    if (linkedUserId === tdriveUserId) return true;
    // Check if in allowed IDs
    const [user] = await db.select().from(users).where(eq(users.id, tdriveUserId)).limit(1);
    if (!user?.telegramAllowedIds) { await ctx.reply(DENY_MSG); return false; }
    const allowed = user.telegramAllowedIds.split(",").map((s) => s.trim()).filter(Boolean);
    if (allowed.includes(tgUserId)) return true;
    await ctx.reply(DENY_MSG);
    return false;
  }

  // /start — Welcome + link account
  bot.command("start", async (ctx) => {
    const tgUserId = String(ctx.from?.id ?? "");
    const tgUsername = ctx.from?.username;
    const tgFirstName = ctx.from?.first_name;

    // Check if someone is already linked
    const existingLink = await getUserByTelegramId(tgUserId);
    const alreadyLinked = existingLink === tdriveUserId;

    if (!alreadyLinked && existingLink) {
      // This Telegram user is linked to a different TDrive account
      return ctx.reply("⛔ This bot is already linked to another account. Each bot can only serve one TDrive user.");
    }

    if (!alreadyLinked) {
      // Check if this TDrive user already has a linked Telegram user
      const existingOwnerLink = await db.select().from(botLinks)
        .where(eq(botLinks.userId, tdriveUserId))
        .limit(1);

      if (existingOwnerLink.length > 0) {
        // Already has a linked user, reject new linkage
        return ctx.reply("⛔ This bot is already linked to another Telegram account. Unregister the bot first to link a new account.");
      }
    }

    // Link Telegram user to TDrive user
    await linkTelegramUser(tdriveUserId, tgUserId, tgUsername, tgFirstName);

    const appUrl = env.APP_URL || "http://localhost:3000";
    await ctx.reply(
      `🔥 *Welcome to TDrive Bot!*\n\n` +
      `I help you manage your cloud storage from Telegram.\n\n` +
      `*Commands:*\n` +
      `/search <query> — Search files by name\n` +
      `/list — Show 10 recent files\n` +
      `/info <filename> — File metadata & share link\n` +
      `/download <filename> — Download file as document\n` +
      `/share <filename> — Generate public share link\n` +
      `/status — Storage usage & health\n` +
      `/stats — Detailed analytics\n` +
      `/topics — List forum topics\n` +
      `/upload — Send a file to store in TDrive\n` +
      `/cancel — Cancel current operation\n` +
      `/getid — Get your Telegram User ID\n` +
      `/help — Show this menu\n\n` +
      `🌐 [Open Dashboard](${appUrl})`,
      { parse_mode: "Markdown", link_preview_options: { is_disabled: true } }
    );
  });

  // /get-id — Show Telegram user info (no auth required)
  bot.command("getid", async (ctx) => {
    const tgUserId = String(ctx.from?.id ?? "");
    const tgUsername = ctx.from?.username ?? "—";
    const tgFirstName = ctx.from?.first_name ?? "—";
    const tgLastName = ctx.from?.last_name ?? "";
    const isBot = ctx.from?.is_bot ?? false;
    const lang = ctx.from?.language_code ?? "—";
    const linkedUserId = await getUserByTelegramId(tgUserId);

    await ctx.reply(
      `🆔 *Your Telegram Info*\n\n` +
      `• User ID: \`${tgUserId}\`\n` +
      `• Username: @${tgUsername}\n` +
      `• Name: ${tgFirstName}${tgLastName ? " " + tgLastName : ""}\n` +
      `• Is Bot: ${isBot ? "Yes" : "No"}\n` +
      `• Language: ${lang}\n` +
      `• Linked to TDrive: ${linkedUserId ? "✅ Yes" : "❌ No"}\n\n` +
      `_Copy the User ID above and paste it in Telegram Bot Settings → Allowed IDs._`,
      { parse_mode: "Markdown" }
    );
  });

  // /help
  bot.command("help", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    await ctx.reply(
      `📖 *TDrive Bot Commands*\n\n` +
      `/getid — Get your Telegram User ID\n` +
      `/search <query> — Search files by name\n` +
      `/list — Show 10 recent files\n` +
      `/info <filename> — File metadata & share link\n` +
      `/download <filename> — Download file as document\n` +
      `/share <filename> — Generate public share link\n` +
      `/status — Storage usage & health\n` +
      `/stats — Detailed analytics\n` +
      `/recent — 8 file terbaru\n` +
      `/dupes — Deteksi file duplikat\n` +
      `/topics — List forum topics in supergroup\n` +
      `/upload — Send a file to store in TDrive\n` +
      `/dl <url> — Download file from URL langsung ke drive\n` +
      `/remind <durasi> <pesan> — Pengingat (contoh: /remind 30m Backup file)\n` +
      `/ask <query> — Tanya storage dengan natural language\n` +
      `/note <teks> — Simpan teks cepat ke folder Inbox (snippet sync)\n` +
      `/cancel — Cancel current operation`,
      { parse_mode: "Markdown" }
    );
  });

  // Helper: build the file list keyboard (file names as clickable buttons)
  function buildFileListKeyboard(items: any[], backData?: string): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (const item of items) {
      const icon = item.kind === "folder" ? "\uD83D\uDCC2" : getFileIcon(item.name);
      const size = item.kind === "file" ? ` (${formatSize(item.size)})` : "";
      const cbData = backData ? `open:${item.id}:${backData}` : `open:${item.id}`;
      kb.text(`${icon} ${item.name}${size}`, cbData).row();
    }
    return kb;
  }

  // Helper: build the action buttons keyboard for a single file
  function buildActionKeyboard(item: any, backData: string): InlineKeyboard {
    return new InlineKeyboard()
      .text("\u2139\uFE0F Info", `info:${item.id}:${backData}`)
      .text("\u2B07\uFE0F Download", `dl:${item.id}`)
      .text("\u{1F517} Share", `share:${item.id}`)
      .row()
      .text("\u2B05\uFE0F Back", backData);
  }

  // /search <query>
  bot.command("search", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const query = ctx.match?.trim();
    if (!query) {
      return ctx.reply("Usage: /search <filename>");
    }

    const items = await db.select().from(driveItems)
      .where(
        and(
          eq(driveItems.userId, tdriveUserId),
          isNull(driveItems.deletedAt),
          ilike(driveItems.name, `%${query}%`)
        )
      )
      .orderBy(desc(driveItems.createdAt))
      .limit(10);

    if (items.length === 0) {
      return ctx.reply(`No files found matching "${query}".`);
    }

    // Truncate query to 32 chars for callback data limit (64 bytes total)
    const shortQ = query.length > 32 ? query.slice(0, 32) : query;
    const backData = `back:s:${shortQ}`;

    await ctx.reply(
      `\u{1F50D} <b>Search "${escHtml(query)}"</b> (${items.length} found)\nTap a file to view actions:`,
      { parse_mode: "HTML", reply_markup: buildFileListKeyboard(items, backData) }
    );
  });

  // /list — Recent files
  bot.command("list", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const items = await db.select().from(driveItems)
      .where(
        and(
          eq(driveItems.userId, tdriveUserId),
          isNull(driveItems.deletedAt)
        )
      )
      .orderBy(desc(driveItems.createdAt))
      .limit(10);

    if (items.length === 0) {
      return ctx.reply("Your drive is empty. Upload some files first!");
    }

    await ctx.reply(
      `\u{1F4C1} <b>Recent files</b> (${items.length})\nTap a file to view actions:`,
      { parse_mode: "HTML", reply_markup: buildFileListKeyboard(items, "back:l") }
    );
  });

  // Helper: show file info (edit message to show details + action buttons)
  async function showFileInfo(ctx: Context, item: any, backData: string) {
    const isFile = item.kind === "file";
    const shareInfo = item.shareToken
      ? `\n\u{1F517} Share: ${env.APP_URL}/s/${item.shareToken}`
      : "\n\u{1F517} Share: Not shared";

    const text =
      `${getFileIcon(item.name)} <b>${escHtml(item.name)}</b>\n\n` +
      `\u{1F4CF} Type: ${item.kind}\n` +
      (isFile ? `\u{1F4BE} Size: ${formatSize(item.size)}\n` : "") +
      (isFile ? `\u{1F4CB} MIME: ${item.mimeType ?? "unknown"}\n` : "") +
      `\u{1F4C5} Created: ${formatDate(item.createdAt)}\n` +
      `\u{1F504} Updated: ${formatDate(item.updatedAt)}\n` +
      (isFile && item.fileHash ? `\u{1F510} Hash: <code>${item.fileHash.slice(0, 16)}...</code>\n` : "") +
      (isFile ? `\u{1F4E5} Downloads: ${item.downloadCount ?? 0}\n` : "") +
      shareInfo;

    const kb = buildActionKeyboard(item, backData);
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: kb,
      link_preview_options: { is_disabled: true },
    }).catch(() => {});
  }

  // Helper: restore the file list header + keyboard after viewing actions
  async function restoreFileList(ctx: Context, items: any[], backData: string, headerText: string) {
    await ctx.editMessageText(headerText, {
      parse_mode: "HTML",
      reply_markup: buildFileListKeyboard(items, backData),
    }).catch(() => {});
  }

  // Inline button callback handler
  bot.on("callback_query:data", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const data = ctx.callbackQuery.data;
    const parts = data.split(":");
    const action = parts[0];
    const id = parts.slice(1).join(":"); // handle IDs with colons

    // Acknowledge the callback immediately
    await ctx.answerCallbackQuery().catch(() => {});

    // Back: re-render list
    if (action === "back" && id === "l") {
      const items = await db.select().from(driveItems)
        .where(and(eq(driveItems.userId, tdriveUserId), isNull(driveItems.deletedAt)))
        .orderBy(desc(driveItems.createdAt))
        .limit(10);
      if (items.length === 0) return ctx.editMessageText("Your drive is empty.").catch(() => {});
      return restoreFileList(ctx, items, "back:l", `\u{1F4C1} <b>Recent files</b> (${items.length})\nTap a file to view actions:`);
    }

    // Back: re-run search
    if (action === "back" && id.startsWith("s:")) {
      const query = id.slice(2);
      const items = await db.select().from(driveItems)
        .where(and(eq(driveItems.userId, tdriveUserId), isNull(driveItems.deletedAt), ilike(driveItems.name, `%${query}%`)))
        .orderBy(desc(driveItems.createdAt))
        .limit(10);
      if (items.length === 0) return ctx.editMessageText(`No files found matching "${query}".`).catch(() => {});
      const shortQ = query.length > 32 ? query.slice(0, 32) : query;
      const backData = `back:s:${shortQ}`;
      return restoreFileList(ctx, items, backData, `\u{1F50D} <b>Search "${escHtml(query)}"</b> (${items.length} found)\nTap a file to view actions:`);
    }

    // Open file: edit message to show file details + action buttons
    if (action === "open") {
      const itemId = parts[1];
      const backData = parts.slice(2).join(":") || "back:l";
      const [item] = await db.select().from(driveItems)
        .where(and(eq(driveItems.userId, tdriveUserId), isNull(driveItems.deletedAt), eq(driveItems.id, itemId)))
        .limit(1);
      if (!item) return ctx.editMessageText("File not found.").catch(() => {});
      return showFileInfo(ctx, item, backData);
    }

    // Info (from action buttons view) — extract item id and back context
    if (action === "info") {
      // id format: {itemId}:{backData}
      const colonIdx = id.indexOf(":");
      const itemId = colonIdx > 0 ? id.slice(0, colonIdx) : id;
      const backCtx = colonIdx > 0 ? id.slice(colonIdx + 1) : "back:l";
      const [item] = await db.select().from(driveItems)
        .where(and(eq(driveItems.userId, tdriveUserId), isNull(driveItems.deletedAt), eq(driveItems.id, itemId)))
        .limit(1);
      if (!item) return ctx.reply("File not found.");
      // Re-show info with preserved back context
      const isFile = item.kind === "file";
      const shareInfo = item.shareToken
        ? `\n\u{1F517} Share: ${env.APP_URL}/s/${item.shareToken}`
        : "\n\u{1F517} Share: Not shared";
      const text =
        `${getFileIcon(item.name)} <b>${escHtml(item.name)}</b>\n\n` +
        `\u{1F4CF} Type: ${item.kind}\n` +
        (isFile ? `\u{1F4BE} Size: ${formatSize(item.size)}\n` : "") +
        (isFile ? `\u{1F4CB} MIME: ${item.mimeType ?? "unknown"}\n` : "") +
        `\u{1F4C5} Created: ${formatDate(item.createdAt)}\n` +
        `\u{1F504} Updated: ${formatDate(item.updatedAt)}\n` +
        (isFile && item.fileHash ? `\u{1F510} Hash: <code>${item.fileHash.slice(0, 16)}...</code>\n` : "") +
        (isFile ? `\u{1F4E5} Downloads: ${item.downloadCount ?? 0}\n` : "") +
        shareInfo;
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildActionKeyboard(item, backCtx),
        link_preview_options: { is_disabled: true },
      }).catch(() => {});
      return;
    }

    // Download
    if (action === "dl") {
      const [item] = await db.select().from(driveItems)
        .where(and(eq(driveItems.userId, tdriveUserId), isNull(driveItems.deletedAt), eq(driveItems.id, id)))
        .limit(1);
      if (!item) return ctx.reply("File not found.");
      if (item.kind !== "file") return ctx.reply("Folders cannot be downloaded.");

      const statusMsg = await ctx.reply(`\u{1F4E5} Downloading <b>${escHtml(item.name)}</b>...`, { parse_mode: "HTML" });

      try {
        // Local file
        if (item.storageRemoteId?.startsWith("local://")) {
          const localPath = item.storageRemoteId.replace("local://", "");
          const candidates = [localPath, resolve("../../storage-temp", localPath), join(process.cwd(), "storage-temp", localPath)];
          const filePath = candidates.find((p) => existsSync(p));
          if (!filePath) return ctx.reply(`\u274C File "${item.name}" not found on local disk.`);
          const buf = await readFile(filePath);
          await ctx.replyWithDocument(new InputFile(buf, item.name), { caption: `${item.name} — ${formatSize(item.size)}` });
          return ctx.api.deleteMessage(ctx.chat?.id ?? 0, statusMsg.message_id).catch(() => {});
        }

        // Telegram-stored file
        if (item.storageRemoteId?.startsWith("telegram://")) {
          const clean = item.storageRemoteId.replace("telegram://", "");
          const [chStr, msgStr] = clean.split("/");
          const channelId = parseInt(chStr, 10);
          const messageId = parseInt(msgStr, 10);
          if (isNaN(channelId) || isNaN(messageId)) return ctx.reply(`\u274C Invalid file reference for "${item.name}".`);

          const [user] = await db.select().from(users).where(eq(users.id, tdriveUserId)).limit(1);
          if (!user?.telegramApiIdEncrypted || !user?.telegramApiHashEncrypted || !user?.telegramSessionEncrypted) {
            return ctx.reply(`\u274C Telegram storage credentials not configured.`);
          }
          const creds = {
            apiId: Number(decryptGlobal(user.telegramApiIdEncrypted)),
            apiHash: decryptGlobal(user.telegramApiHashEncrypted),
            sessionString: decryptGlobal(user.telegramSessionEncrypted),
          };
          const { buffer } = await downloadFile(tdriveUserId, creds, channelId, messageId, 0, undefined, user.telegramStorageChannelName || env.TDRIVE_STORAGE_CHANNEL, (user.telegramStorageMode || "supergroup") === "supergroup");
          if (!buffer || buffer.length === 0) return ctx.reply(`\u274C Failed to download "${item.name}" from Telegram storage.`);
          await ctx.replyWithDocument(new InputFile(buffer, item.name), { caption: `${item.name} — ${formatSize(buffer.length)}` });
          return ctx.api.deleteMessage(ctx.chat?.id ?? 0, statusMsg.message_id).catch(() => {});
        }

        // Fallback: share link
        const appUrl = env.APP_URL || "http://localhost:3000";
        const token = item.shareToken || (await import("node:crypto")).randomUUID();
        if (!item.shareToken) await db.update(driveItems).set({ shareToken: token, updatedAt: new Date() }).where(eq(driveItems.id, item.id));
        await ctx.reply(`${item.name}\n\n${appUrl}/s/${token}`);
        await ctx.api.deleteMessage(ctx.chat?.id ?? 0, statusMsg.message_id).catch(() => {});
      } catch (err: any) {
        console.error(`[bot] inline download error:`, err);
        await ctx.reply(`\u274C Error downloading "${item.name}": ${err.message ?? "Unknown error"}`);
        await ctx.api.deleteMessage(ctx.chat?.id ?? 0, statusMsg.message_id).catch(() => {});
      }
      return;
    }

    // Share
    if (action === "share") {
      const [item] = await db.select().from(driveItems)
        .where(and(eq(driveItems.userId, tdriveUserId), isNull(driveItems.deletedAt), eq(driveItems.id, id)))
        .limit(1);
      if (!item) return ctx.reply("File not found.");

      const token = item.shareToken || (await import("node:crypto")).randomUUID();
      if (!item.shareToken) await db.update(driveItems).set({ shareToken: token, updatedAt: new Date() }).where(eq(driveItems.id, item.id));

      const appUrl = env.APP_URL || "http://localhost:3000";
      const kb = new InlineKeyboard().url("\u{1F517} Open Link", `${appUrl}/s/${token}`);
      await ctx.reply(
        `\u{1F517} <b>Share: ${escHtml(item.name)}</b>\n\n${appUrl}/s/${token}`,
        { parse_mode: "HTML", reply_markup: kb, link_preview_options: { is_disabled: true } }
      );
      return;
    }
  });

  // /info <filename>
  bot.command("info", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const name = ctx.match?.trim();
    if (!name) {
      return ctx.reply("Usage: /info <filename>");
    }

    const [item] = await db.select().from(driveItems)
      .where(
        and(
          eq(driveItems.userId, tdriveUserId),
          isNull(driveItems.deletedAt),
          ilike(driveItems.name, `%${name}%`)
        )
      )
      .limit(1);

    if (!item) {
      return ctx.reply(`File "${name}" not found.`);
    }

    return showFileInfo(ctx, item, "back:l");
  });

  // /download <filename>
  bot.command("download", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const name = ctx.match?.trim();
    if (!name) {
      return ctx.reply("Usage: /download <filename>");
    }

    const [item] = await db.select().from(driveItems)
      .where(
        and(
          eq(driveItems.userId, tdriveUserId),
          isNull(driveItems.deletedAt),
          ilike(driveItems.name, `%${name}%`),
          eq(driveItems.kind, "file")
        )
      )
      .limit(1);

    if (!item) {
      return ctx.reply(`File "${name}" not found.`);
    }

    const statusMsg = await ctx.reply(`📥 Downloading *${item.name}*...`, { parse_mode: "Markdown" });

    try {
      // 1. Local file — read from disk and send
      if (item.storageRemoteId?.startsWith("local://")) {
        const localPath = item.storageRemoteId.replace("local://", "");
        const candidates = [
          localPath,
          resolve("../../storage-temp", localPath),
          join(process.cwd(), "storage-temp", localPath),
        ];
        const filePath = candidates.find((p) => existsSync(p));
        if (!filePath) {
          return ctx.reply(`❌ File "${item.name}" not found on local disk.`);
        }
        const buf = await readFile(filePath);
        await ctx.replyWithDocument(new InputFile(buf, item.name), {
          caption: `📄 ${item.name} — ${formatSize(item.size)}`,
        });
        return ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
      }

      // 2. Telegram-stored file — download via MTProto, send via Bot API
      if (item.storageRemoteId?.startsWith("telegram://")) {
        const clean = item.storageRemoteId.replace("telegram://", "");
        const parts = clean.split("/");
        const channelId = parseInt(parts[0], 10);
        const messageId = parseInt(parts[1], 10);
        if (isNaN(channelId) || isNaN(messageId)) {
          return ctx.reply(`❌ Invalid file reference for "${item.name}".`);
        }

        // Get user's MTProto credentials
        const [user] = await db.select().from(users).where(eq(users.id, tdriveUserId)).limit(1);
        if (!user?.telegramApiIdEncrypted || !user?.telegramApiHashEncrypted || !user?.telegramSessionEncrypted) {
          return ctx.reply(`❌ Telegram storage credentials not configured. Use the web dashboard to set up Telegram storage first.`);
        }
        const creds = {
          apiId: Number(decryptGlobal(user.telegramApiIdEncrypted)),
          apiHash: decryptGlobal(user.telegramApiHashEncrypted),
          sessionString: decryptGlobal(user.telegramSessionEncrypted),
        };

        const { buffer } = await downloadFile(
          tdriveUserId,
          creds,
          channelId,
          messageId,
          0,
          undefined,
          user.telegramStorageChannelName || env.TDRIVE_STORAGE_CHANNEL,
          (user.telegramStorageMode || "supergroup") === "supergroup"
        );
        if (!buffer || buffer.length === 0) {
          return ctx.reply(`❌ Failed to download "${item.name}" from Telegram storage.`);
        }

        await ctx.replyWithDocument(new InputFile(buffer, item.name), {
          caption: `📄 ${item.name} — ${formatSize(buffer.length)}`,
        });
        return ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
      }

      // 3. Unknown provider — fall back to share link
      const appUrl = env.APP_URL || "http://localhost:3000";
      if (item.shareToken) {
        return ctx.reply(
          `📥 *${item.name}*\n\n🔗 [Download Link](${appUrl}/s/${item.shareToken})`,
          { parse_mode: "Markdown" }
        );
      }
      // Auto-create share link
      const { randomUUID } = await import("node:crypto");
      const token = randomUUID();
      await db.update(driveItems).set({ shareToken: token, updatedAt: new Date() }).where(eq(driveItems.id, item.id));
      await ctx.reply(
        `📥 *${item.name}* — Storage: ${item.storageProvider}\n\n🔗 [Download Link](${appUrl}/s/${token})`,
        { parse_mode: "Markdown" }
      );
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    } catch (err: any) {
      console.error(`[bot] /download error:`, err);
      await ctx.reply(`❌ Error downloading "${item.name}": ${err.message ?? "Unknown error"}`);
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    }
  });

  // /share <filename>
  bot.command("share", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const name = ctx.match?.trim();
    if (!name) {
      return ctx.reply("Usage: /share <filename>");
    }

    const [item] = await db.select().from(driveItems)
      .where(
        and(
          eq(driveItems.userId, tdriveUserId),
          isNull(driveItems.deletedAt),
          ilike(driveItems.name, `%${name}%`)
        )
      )
      .limit(1);

    if (!item) {
      return ctx.reply(`File "${name}" not found.`);
    }

    const { randomUUID } = await import("node:crypto");
    const token = item.shareToken || randomUUID();

    await db.update(driveItems).set({
      shareToken: token,
      updatedAt: new Date(),
    }).where(eq(driveItems.id, item.id));

    const appUrl = env.APP_URL || "http://localhost:3000";
    await ctx.reply(
      `🔗 *Share link created for "${item.name}"*\n\n` +
      `${appUrl}/s/${token}`,
      { parse_mode: "Markdown", link_preview_options: { is_disabled: true } }
    );
  });

  // /status — Storage usage
  bot.command("status", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const items = await db.select().from(driveItems)
      .where(
        and(
          eq(driveItems.userId, tdriveUserId),
          isNull(driveItems.deletedAt)
        )
      );

    let totalSize = 0;
    let fileCount = 0;
    let folderCount = 0;

    for (const item of items) {
      if (item.kind === "file") {
        totalSize += item.size || 0;
        fileCount++;
      } else {
        folderCount++;
      }
    }

    const appUrl = env.APP_URL || "http://localhost:3000";
    await ctx.reply(
      `☁️ *TDrive Storage Status*\n\n` +
      `💾 Total Size: *${formatSize(totalSize)}*\n` +
      `📄 Files: *${fileCount}*\n` +
      `📂 Folders: *${folderCount}*\n` +
      `📊 Total Items: *${items.length}*\n\n` +
      `🌐 [Open Dashboard](${appUrl})`,
      { parse_mode: "Markdown" }
    );
  });

  // /stats — Analytics
  bot.command("stats", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const items = await db.select().from(driveItems)
      .where(
        and(
          eq(driveItems.userId, tdriveUserId),
          isNull(driveItems.deletedAt),
          eq(driveItems.kind, "file")
        )
      );

    const categories: Record<string, { count: number; size: number }> = {
      images: { count: 0, size: 0 },
      videos: { count: 0, size: 0 },
      documents: { count: 0, size: 0 },
      audio: { count: 0, size: 0 },
      archives: { count: 0, size: 0 },
      code: { count: 0, size: 0 },
      other: { count: 0, size: 0 },
    };

    for (const item of items) {
      const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
      let cat = "other";
      if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) cat = "images";
      else if (["mp4", "avi", "mkv", "mov"].includes(ext)) cat = "videos";
      else if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) cat = "documents";
      else if (["mp3", "wav", "flac", "ogg"].includes(ext)) cat = "audio";
      else if (["zip", "rar", "7z", "tar"].includes(ext)) cat = "archives";
      else if (["js", "ts", "py", "go", "rs", "java"].includes(ext)) cat = "code";

      categories[cat].count++;
      categories[cat].size += item.size || 0;
    }

    const lines = Object.entries(categories)
      .filter(([, v]) => v.count > 0)
      .map(([cat, v]) => `• ${cat}: ${v.count} files (${formatSize(v.size)})`)
      .join("\n");

    await ctx.reply(
      `📊 *Storage Analytics*\n\n` +
      (lines || "No files yet.") +
      `\n\n📁 Total: *${items.length} files*`,
      { parse_mode: "Markdown" }
    );
  });

  // /topics — List forum topics in supergroup
  bot.command("topics", async (ctx) => {
    if (!(await requireAuth(ctx))) return;

    const [user] = await db.select().from(users).where(eq(users.id, tdriveUserId)).limit(1);
    if (!user?.telegramApiIdEncrypted || !user?.telegramApiHashEncrypted || !user?.telegramSessionEncrypted) {
      return ctx.reply("❌ Telegram storage credentials not configured. Use the web dashboard to set up Telegram storage first.");
    }
    if ((user.telegramStorageMode || "supergroup") !== "supergroup") {
      return ctx.reply("📋 Forum topics are only available in Supergroup mode.");
    }

    try {
      const creds = {
        apiId: Number(decryptGlobal(user.telegramApiIdEncrypted)),
        apiHash: decryptGlobal(user.telegramApiHashEncrypted),
        sessionString: decryptGlobal(user.telegramSessionEncrypted),
      };
      const client = await getClient(tdriveUserId, creds);
      const channelName = user.telegramStorageChannelName || env.TDRIVE_STORAGE_CHANNEL;
      const channel = await findChannel(client, channelName);

      if (!channel) {
        return ctx.reply(`❌ Storage supergroup "${channelName}" not found.`);
      }

      const topics = await getForumTopics(client, channel);

      if (topics.length === 0) {
        return ctx.reply("📋 No forum topics found. Create topics from the web dashboard first.");
      }

      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const lines = topics.map((t, i) => `${i + 1}. \u{1F4CC} <b>${esc(t.title)}</b> (ID: <code>${t.id}</code>)`).join("\n");
      await ctx.reply(
        `\u{1F4CB} <b>Forum Topics in ${esc(channelName)}:</b>\n\n${lines}\n\n` +
        `<i>Use /upload &lt;topic_id&gt; to upload to a specific topic.</i>`,
        { parse_mode: "HTML" }
      );
    } catch (err: any) {
      console.error(`[bot] /topics error:`, err);
      await ctx.reply(`❌ Error fetching topics: ${err.message ?? "Unknown error"}`);
    }
  });

  // /upload [topic_id] — Upload a file, optionally to a specific forum topic
  bot.command("upload", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const topicArg = ctx.match?.trim();

    if (topicArg) {
      // Store selected topic in chat state for next file upload
      const topicId = parseInt(topicArg, 10);
      if (isNaN(topicId)) {
        return ctx.reply("❌ Invalid topic ID. Use /topics to see available topics.");
      }
      await setChatState(tdriveUserId, tdriveUserId, String(ctx.chat?.id ?? ""), "awaiting_upload", JSON.stringify({ topicId }));
      return ctx.reply(
        `📤 *Upload to Topic ${topicId}*\n\n` +
        `Topic selected! Send a file now to upload it to this topic.\n` +
        `Send /cancel to abort.`,
        { parse_mode: "Markdown" }
      );
    }

    await ctx.reply(
      `📤 <b>Upload File to TDrive</b>\n\n` +
      `<b>Cara upload:</b>\n` +
      `1. Kirim file langsung ke chat ini (tanpa perintah)\n` +
      `2. Atau gunakan /upload &lt;topic_id&gt; untuk upload ke topic tertentu\n\n` +
      `<b>Perintah terkait:</b>\n` +
      `• /topics — Lihat daftar forum topic\n` +
      `• /cancel — Batalkan operasi\n\n` +
      `<i>File akan otomatis di-sync ke Telegram storage.</i>`,
      { parse_mode: "HTML" }
    );
  });

  // Upload — Handle file uploads (user replies to or sends a file)
  // Extract the core upload logic so both document and photo handlers can share it
  async function handleFileUpload(ctx: Context, fileId: string, fileName: string, fileSize: number, mimeType: string) {
    if (!(await requireAuth(ctx))) return;

    // Check if there's a pending upload topic from /upload <topic_id>
    const chatState = await getChatState(tdriveUserId);
    let pendingTopicId: number | undefined;
    if (chatState?.state === "awaiting_upload" && chatState.stateData) {
      try {
        const data = JSON.parse(chatState.stateData);
        pendingTopicId = data.topicId;
      } catch {}
      await clearChatState(tdriveUserId);
    }

    const topicLabel = pendingTopicId ? ` (Topic ${pendingTopicId})` : "";
    const statusMsg = await ctx.reply(`\u{1F4E5} Uploading *${fileName}*${topicLabel} to TDrive...`, { parse_mode: "Markdown" });

    try {
      // 1. Download file from Telegram Bot API
      const fileInfo = await ctx.api.getFile(fileId);
      if (!fileInfo.file_path) {
        return ctx.reply(`\u274C Failed to get file from Telegram.`);
      }
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${fileInfo.file_path}`;
      const resp = await fetch(fileUrl);
      if (!resp.ok) {
        return ctx.reply(`\u274C Failed to download file from Telegram.`);
      }
      const arrayBuf = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      // 2. Check for duplicate by hash
      const { createHash } = await import("node:crypto");
      const fileHash = createHash("sha256").update(buffer).digest("hex");

      const [existingFile] = await db.select().from(driveItems)
        .where(
          and(
            eq(driveItems.userId, tdriveUserId),
            eq(driveItems.fileHash, fileHash),
            isNull(driveItems.deletedAt)
          )
        )
        .limit(1);

      if (existingFile) {
        await ctx.reply(
          `\u2705 File *${fileName}* already exists as *${existingFile.name}* (${formatSize(existingFile.size)}).`,
          { parse_mode: "Markdown" }
        );
        return ctx.api.deleteMessage(ctx.chat?.id ?? 0, statusMsg.message_id).catch(() => {});
      }

      // 3. Write to temp directory
      const tempDir = resolve("../../storage-temp");
      if (!existsSync(tempDir)) {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
      }
      const stagedPath = join(tempDir, `${nanoid(21)}_${fileName}`);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(stagedPath, buffer);

      // 4. Try auto-sync to Telegram storage
      let storageProvider = "local";
      let storageRemoteId = `local://${nanoid(21)}`;
      let syncStatus = "local";

      const [user] = await db.select().from(users).where(eq(users.id, tdriveUserId)).limit(1);
      if (user?.telegramApiIdEncrypted && user?.telegramApiHashEncrypted && user?.telegramSessionEncrypted) {
        const creds = {
          apiId: Number(decryptGlobal(user.telegramApiIdEncrypted)),
          apiHash: decryptGlobal(user.telegramApiHashEncrypted),
          sessionString: decryptGlobal(user.telegramSessionEncrypted),
        };
        try {
          const channelName = user.telegramStorageChannelName || env.TDRIVE_STORAGE_CHANNEL;
          const isSupergroup = (user.telegramStorageMode || "supergroup") === "supergroup";
          const result = await uploadFile(tdriveUserId, creds, stagedPath, fileName, mimeType || undefined, pendingTopicId, channelName, isSupergroup);
          storageRemoteId = `telegram://${result.channelId}/${result.messageId}`;
          storageProvider = isSupergroup ? "telegram-supergroup-topic" : "telegram-private-channel";
          syncStatus = "synced";
          const { unlink } = await import("node:fs/promises");
          await unlink(stagedPath).catch(() => {});
        } catch (err) {
          console.error(`[bot] Auto-sync failed, keeping local:`, err);
        }
      }

      // 5. Create drive item record
      const id = nanoid(21);
      await db.insert(driveItems).values({
        id,
        userId: tdriveUserId,
        kind: "file",
        name: fileName,
        parentId: null,
        size: fileSize || buffer.length,
        mimeType: mimeType || "application/octet-stream",
        storageProvider,
        storageRemoteId,
        storageChannelName: user?.telegramStorageChannelName || "TeleDrive Storage",
        syncStatus,
        fileHash,
      });

      const syncLabel = syncStatus === "synced"
        ? `\u2601\uFE0F Synced to Telegram${pendingTopicId ? ` (Topic ${pendingTopicId})` : ""}`
        : "\uD83D\uDCBE Stored locally";
      await ctx.reply(
        `\u2705 *${fileName}* uploaded!\n\n` +
        `\uD83D\uDCCF Size: ${formatSize(fileSize || buffer.length)}\n` +
        `${syncLabel}`,
        { parse_mode: "Markdown" }
      );
      await ctx.api.deleteMessage(ctx.chat?.id ?? 0, statusMsg.message_id).catch(() => {});
    } catch (err: any) {
      console.error(`[bot] Upload error:`, err);
      await ctx.reply(`\u274C Error uploading "${fileName}": ${err.message ?? "Unknown error"}`);
      await ctx.api.deleteMessage(ctx.chat?.id ?? 0, statusMsg.message_id).catch(() => {});
    }
  }

  // Handle document uploads
  bot.on("message:document", async (ctx) => {
    const doc = ctx.message.document;
    if (!doc?.file_name) return;
    await handleFileUpload(ctx, doc.file_id, doc.file_name, doc.file_size || 0, doc.mime_type || "");
  });

  // Handle photo uploads (images sent as photos, not documents)
  bot.on("message:photo", async (ctx) => {
    const photos = ctx.message.photo;
    if (!photos || photos.length === 0) return;
    // Pick the largest photo size
    const best = photos[photos.length - 1];
    const ext = (ctx.message.caption || "photo").includes(".") ? "" : ".jpg";
    const fileName = `photo_${Date.now()}${ext}`;
    await handleFileUpload(ctx, best.file_id, fileName, best.file_size || 0, "image/jpeg");
  });

  // /cancel — Cancel current operation
  bot.command("cancel", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const tgUserId = String(ctx.from?.id ?? "");
    await clearChatState(tgUserId);
    await ctx.reply("✅ Operation cancelled.");
  });

  // Handle text messages (for state-based flows)
  // /recent — File terbaru di drive
  bot.command("recent", async (ctx) => {
    if (!(await requireAuth(ctx))) return;

    const items = await db.select().from(driveItems)
      .where(
        and(
          eq(driveItems.userId, tdriveUserId),
          isNull(driveItems.deletedAt),
          eq(driveItems.kind, "file")
        )
      )
      .orderBy(desc(driveItems.updatedAt))
      .limit(8);

    if (items.length === 0) {
      await ctx.reply("Belum ada file di drive Anda.");
      return;
    }

    const lines = items.map((item, i) => {
      const date = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "?";
      return `${i + 1}. ${getFileIcon(item.name)} *${item.name}* (${formatSize(item.size)}) — ${date}`;
    });

    await ctx.reply(
      `🕐 *File Terbaru*\n\n${lines.join("\n")}\n\n💡 Ketik /search <kata kunci> untuk mencari.`,
      { parse_mode: "Markdown" }
    );
  });

  // /dupes — Deteksi file duplikat (hash atau nama+ukuran)
  bot.command("dupes", async (ctx) => {
    if (!(await requireAuth(ctx))) return;

    const items = await db.select().from(driveItems)
      .where(
        and(
          eq(driveItems.userId, tdriveUserId),
          isNull(driveItems.deletedAt),
          eq(driveItems.kind, "file")
        )
      );

    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.fileHash || `${item.name}-${item.size}`;
      const group = map.get(key) || [];
      group.push(item);
      map.set(key, group);
    }

    const dupes = Array.from(map.values()).filter((g) => g.length > 1);

    if (dupes.length === 0) {
      await ctx.reply("✅ Tidak ada file duplikat ditemukan.");
      return;
    }

    let totalSaved = 0;
    const blocks = dupes.slice(0, 5).map((group) => {
      const first = group[0];
      const extras = group.length - 1;
      const wasted = extras * (first.size || 0);
      totalSaved += wasted;
      return `📄 *${first.name}* — ${group.length}x (hemat ${formatSize(wasted)})`;
    });

    await ctx.reply(
      `🔁 *File Duplikat Ditemukan: ${dupes.length} grup*\n\n${blocks.join("\n")}\n\n💾 Potensi hemat: *${formatSize(totalSaved)}*\nGunakan fitur Duplicates di web untuk membersihkan.`,
      { parse_mode: "Markdown" }
    );
  });

  // /ask <query> — Tanya soal storage dengan natural language
  bot.command("ask", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const query = ctx.match?.trim();
    if (!query) {
      return ctx.reply(
        `🤖 *TDrive Assistant*\n\n` +
        `Tanya soal file Anda dengan bahasa alami!\n\n` +
        `Contoh:\n` +
        `• /ask video terbaru\n` +
        `• /ask foto bulan lalu\n` +
        `• /ask dokumen > 50 MB\n` +
        `• /ask file tag:kerjaan`,
        { parse_mode: "Markdown" }
      );
    }
    const statusMsg = await ctx.reply("🤖 Mencari…");
    try {
      const result = await searchNaturalLanguage(tdriveUserId, query);
      await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id);
      await ctx.reply(result.answer || "Tidak ada hasil.", { parse_mode: "Markdown" });
    } catch (err: any) {
      await ctx.reply(`❌ Gagal: ${err?.message || "unknown"}`);
    }
  });

  // /note <teks> — Simpan teks cepat sebagai file di folder Inbox (snippet sync)
  bot.command("note", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const text = ctx.match?.trim();
    if (text) {
      await saveSnippet(tdriveUserId, text);
      return ctx.reply(`📝 Snippet tersimpan ke Inbox!\n\n> ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`);
    }
    await setChatState(tdriveUserId, tdriveUserId, String(ctx.chat?.id ?? ""), "awaiting_note", "");
    return ctx.reply("📝 Kirim teks apapun, saya akan simpan sebagai file di folder Inbox. /cancel untuk batal.");
  });

  // /dl <url> — Download file dari URL langsung ke lokal storage
  bot.command("dl", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const url = ctx.match?.trim();
    if (!url || !url.startsWith("http")) {
      return ctx.reply("❌ Gunakan: /dl <url>\nContoh: /dl https://example.com/file.pdf");
    }
    const statusMsg = await ctx.reply(`⬇️ Mendownload *${url}*...`, { parse_mode: "Markdown" });
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const { createHash } = await import("node:crypto");
      const fileHash = createHash("sha256").update(buf).digest("hex");

      // Simpan ke lokal temp
      const TEMP_DIR = resolve("./storage-temp");
      await mkdir(TEMP_DIR, { recursive: true });
      const localName = `dl-${nanoid(12)}-${basename(decodeURIComponent(new URL(url).pathname)) || "download.bin"}`;
      const localPath = join(TEMP_DIR, localName);
      await writeFile(localPath, buf);

      // Ambil nama file dari URL
      const fileName = basename(decodeURIComponent(new URL(url).pathname)) || `download-${Date.now()}`;

      // Cari mime type dari Content-Type header atau ekstensi
      const mimeType = resp.headers.get("content-type") || "application/octet-stream";

      // Buat record di DB
      const newId = nanoid(16);
      await db.insert(driveItems).values({
        id: newId,
        userId: tdriveUserId,
        kind: "file",
        name: fileName,
        size: buf.length,
        mimeType: mimeType,
        storageRemoteId: `local://${localName}`,
        storageProvider: "local",
        syncStatus: "local",
        fileHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id);
      await ctx.reply(
        `✅ *${fileName}* diunduh (${formatSize(buf.length)}) dan tersimpan di TDrive!`,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      await ctx.reply(`❌ Gagal mendownload: ${err.message || "Unknown error"}`);
    }
  });

  // /remind <durasi> <pesan> — Jadwalkan pengingat
  bot.command("remind", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const text = ctx.match?.trim() || "";
    const matchDur = text.match(/^(\d+)(s|m|h|d)\s+(.+)/i);
    if (!matchDur) {
      return ctx.reply(
        `⏰ *Pengingat*\n\n` +
        `Gunakan: /remind <durasi> <pesan>\n` +
        `Contoh: /remind 30m Backup file\n` +
        `         /remind 2h Cek storage\n` +
        `         /remind 1d Meeting notes\n\n` +
        `Durasi: s=detik, m=menit, h=jam, d=hari`,
        { parse_mode: "Markdown" }
      );
    }
    const value = parseInt(matchDur[1], 10);
    const unit = matchDur[2].toLowerCase();
    const message = matchDur[3];
    const ms = unit === "s" ? value * 1000 : unit === "m" ? value * 60_000 : unit === "h" ? value * 3600_000 : value * 86400_000;

    if (ms < 10_000) return ctx.reply("⚠️ Minimal durasi 10 detik.");
    if (ms > 365 * 86400_000) return ctx.reply("⚠️ Maksimal durasi 1 tahun.");

    const chatId = ctx.chat!.id;
    const when = new Date(Date.now() + ms);
    const remaining = formatDuration(ms);

    await ctx.reply(
      `⏰ Pengingat disetel!\n\n` +
      `📝 *${message}*\n` +
      `🕐 Waktu: ${when.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}\n` +
      `⏳ Sisa: ${remaining}`,
      { parse_mode: "Markdown" }
    );

    // Timer non-blocking
    const timer = setTimeout(async () => {
      try {
        await ctx.api.sendMessage(chatId, `⏰ *Pengingat!*\n\n${message}`, { parse_mode: "Markdown" });
      } catch {}
    }, ms);
    // Jangan biarkan timer mencegah exit
    if (timer.unref) timer.unref();
  });

  bot.on("message:text", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    const tgUserId = String(ctx.from?.id ?? "");
    const chatState = await getChatState(tgUserId);

    if (!chatState || chatState.state === "idle") {
      // Unknown command — show help
      if (ctx.message.text.startsWith("/")) {
        await ctx.reply("Unknown command. Type /help for available commands.");
      }
      return;
    }

    // Handle state-based flows
    if (chatState.state === "awaiting_search") {
      // Redirect to search
      const query = ctx.message.text.trim();
      const items = await db.select().from(driveItems)
        .where(
          and(
            eq(driveItems.userId, tdriveUserId),
            isNull(driveItems.deletedAt),
            ilike(driveItems.name, `%${query}%`)
          )
        )
        .orderBy(desc(driveItems.createdAt))
        .limit(10);

      if (items.length === 0) {
        await ctx.reply(`No files found matching "${query}".`);
      } else {
        const lines = items.map((item, i) => {
          const icon = item.kind === "folder" ? "📂" : getFileIcon(item.name);
          const size = item.kind === "file" ? ` (${formatSize(item.size)})` : "";
          return `${i + 1}. ${icon} *${item.name}*${size}`;
        });
        await ctx.reply(
          `🔍 *Results for "${query}":*\n\n${lines.join("\n")}`,
          { parse_mode: "Markdown" }
        );
      }
      await clearChatState(tgUserId);
    }

    // Handle snippet capture
    if (chatState.state === "awaiting_note") {
      const text = ctx.message.text.trim();
      await clearChatState(tgUserId);
      if (text.startsWith("/") || text.length === 0) {
        return ctx.reply("Batal — tidak ada teks untuk disimpan.");
      }
      try {
        await saveSnippet(tdriveUserId, text);
        await ctx.reply(
          `📝 Snippet tersimpan ke Inbox!\n\n> ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}\n\nCek di folder *Inbox* di drive Anda.`,
          { parse_mode: "Markdown" }
        );
      } catch (err: any) {
        await ctx.reply(`❌ Gagal menyimpan snippet: ${err?.message || "unknown"}`);
      }
      return;
    }
  });
}