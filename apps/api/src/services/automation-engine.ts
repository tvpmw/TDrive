/**
 * Automation Engine — mengeksekusi aturan user (automation_rules) saat event file terjadi.
 * Action types didukung:
 *  - "move-to-folder": pindahkan file ke folder target (config.targetFolderName | target_folder_id)
 *  - "tag": set tags (config.tags = "csv")
 *  - "webhook": kirim POST ke targetUrl
 */
import { db } from "../db/index.js";
import { driveItems } from "../db/schema/drive-items.js";
import { automationRules } from "../db/schema/advanced-features.js";
import { eq, and, isNull } from "drizzle-orm";

export interface FileEvent {
  userId: string;
  itemId: string;
  itemName: string;
  itemSize: number;
  mimeType: string | null;
  parentId: string | null;
}

interface RuleConfig {
  conditions?: { field?: string; op?: string; value?: string }[];
  action?: string;
  targetFolderName?: string;
  targetFolderId?: string;
  tags?: string;
  [key: string]: unknown;
}

// Evaluasi kondisi rule terhadap item file
function matchesConditions(item: FileEvent, config: RuleConfig): boolean {
  const conditions = config.conditions ?? [];
  if (conditions.length === 0) return true;
  const ext = item.itemName.split(".").pop()?.toLowerCase() ?? "";
  for (const cond of conditions) {
    const field = cond.field ?? "extension";
    const op = cond.op ?? "eq";
    const value = (cond.value ?? "").toLowerCase();
    let actual: string | number;
    if (field === "extension") actual = ext;
    else if (field === "name") actual = item.itemName.toLowerCase();
    else if (field === "mimeType") actual = (item.mimeType ?? "").toLowerCase();
    else if (field === "size") actual = item.itemSize;
    else if (field === "parentId") actual = item.parentId ?? "";
    else continue; // field tidak dikenal — lewati

    let match = false;
    if (op === "eq") match = String(actual).toLowerCase() === value;
    else if (op === "contains") match = String(actual).toLowerCase().includes(value);
    else if (op === "startsWith") match = String(actual).toLowerCase().startsWith(value);
    else if (op === "gt") match = Number(actual) > Number(value || 0);
    else if (op === "lt") match = Number(actual) < Number(value || 0);
    if (!match) return false;
  }
  return true;
}

async function resolveTargetFolder(userId: string, config: RuleConfig): Promise<string | null> {
  // target folder by id
  if (config.targetFolderId) {
    const [f] = await db.select().from(driveItems)
      .where(and(eq(driveItems.id, config.targetFolderId), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
      .limit(1);
    if (f?.kind === "folder") return f.id;
  }
  // target folder by name (buat jika belum ada)
  if (config.targetFolderName) {
    const name = config.targetFolderName;
    const [existing] = await db.select().from(driveItems)
      .where(and(eq(driveItems.userId, userId), eq(driveItems.kind, "folder"), eq(driveItems.name, name), isNull(driveItems.parentId), isNull(driveItems.deletedAt)))
      .limit(1);
    if (existing) return existing.id;
    const id = `auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(driveItems).values({
      id,
      userId,
      kind: "folder",
      name,
      size: 0,
    });
    return id;
  }
  return null;
}

// Jalankan semua rules aktif user untuk event file.uploaded
export async function runAutomationOnUpload(event: FileEvent): Promise<{ ruleId: string; action: string; result: string }[]> {
  const results: { ruleId: string; action: string; result: string }[] = [];
  const rules = await db.select().from(automationRules)
    .where(and(eq(automationRules.userId, event.userId), eq(automationRules.isActive, 1), eq(automationRules.triggerEvent, "file.uploaded")));

  for (const rule of rules) {
    try {
      const config = (rule.config ?? {}) as RuleConfig;
      if (!matchesConditions(event, config)) continue;
      const action = rule.actionType || config.action || "webhook";

      if (action === "move-to-folder") {
        const folderId = await resolveTargetFolder(event.userId, config);
        if (folderId) {
          await db.update(driveItems).set({ parentId: folderId, updatedAt: new Date() }).where(eq(driveItems.id, event.itemId));
          results.push({ ruleId: rule.id, action, result: `dipindah ke folder ${config.targetFolderName ?? folderId}` });
        }
      } else if (action === "tag") {
        if (config.tags) {
          await db.update(driveItems).set({ tags: config.tags, updatedAt: new Date() }).where(eq(driveItems.id, event.itemId));
          results.push({ ruleId: rule.id, action, result: `tags: ${config.tags}` });
        }
      } else if (action === "webhook") {
        if (rule.targetUrl) {
          await fetch(rule.targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event, ruleId: rule.id, action }),
            signal: AbortSignal.timeout(15_000),
          }).catch(() => {
            // webhook gagal — jangan crash upload
          });
          results.push({ ruleId: rule.id, action, result: `webhook ${rule.targetUrl}` });
        }
      }
    } catch {
      // rule gagal — lanjut ke rule berikutnya
    }
  }
  return results;
}
