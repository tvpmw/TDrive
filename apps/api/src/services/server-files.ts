import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, renameSync, unlinkSync, rmSync, createReadStream, createWriteStream, copyFileSync } from "fs";
import { join, resolve, relative, sep } from "path";
import { getEnv } from "../env.js";
import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";

export interface ServerFileItem {
  name: string;
  path: string;
  kind: "file" | "folder";
  size: number;
  modifiedAt: string;
}

export class LocalServerFiles {
  private root: string;

  constructor(root?: string) {
    this.root = resolve(root ?? getEnv().SERVER_FILES_ROOT);
    this.ensureRoot();
  }

  private ensureRoot() {
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
  }

  private safePath(subPath: string): string {
    // Prevent path traversal
    const full = resolve(join(this.root, subPath));
    if (!full.startsWith(this.root)) {
      throw new Error("Path traversal denied");
    }
    return full;
  }

  get relativeRoot(): string {
    return this.root;
  }

  status() {
    const ready = existsSync(this.root);
    try {
      readdirSync(this.root);
    } catch {
      return { ready: false, mode: "local" as const };
    }
    return { ready, mode: "local" as const };
  }

  list(subPath = ""): ServerFileItem[] {
    const dir = this.safePath(subPath);
    if (!existsSync(dir)) return [];
    const entries = readdirSync(dir, { withFileTypes: true });
    const items: ServerFileItem[] = [];
    for (const entry of entries) {
      const relPath = subPath ? `${subPath}/${entry.name}` : entry.name;
      const fullPath = join(dir, entry.name);
      try {
        const stat = statSync(fullPath);
        items.push({
          name: entry.name,
          path: relPath,
          kind: entry.isDirectory() ? "folder" : "file",
          size: entry.isDirectory() ? 0 : stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      } catch {
        // skip inaccessible
      }
    }
    return items.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  createFolder(subPath: string): void {
    const full = this.safePath(subPath);
    mkdirSync(full, { recursive: true });
  }

  async upload(subPath: string, buffer: ArrayBuffer): Promise<void> {
    const full = this.safePath(subPath);
    const dir = full.substring(0, full.lastIndexOf(sep));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    await writeFile(full, Buffer.from(buffer));
  }

  download(subPath: string): { path: string; mime: string } {
    const full = this.safePath(subPath);
    if (!existsSync(full)) throw new Error("File not found");
    const ext = full.split(".").pop()?.toLowerCase() ?? "";
    const mimeMap: Record<string, string> = {
      txt: "text/plain", html: "text/html", css: "text/css",
      js: "application/javascript", json: "application/json",
      pdf: "application/pdf", png: "image/png", jpg: "image/jpeg",
      jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
      mp4: "video/mp4", zip: "application/zip", tar: "application/x-tar",
      gz: "application/gzip", csv: "text/csv", md: "text/markdown",
      xml: "application/xml", yaml: "text/yaml", yml: "text/yaml",
      py: "text/x-python", ts: "text/typescript", tsx: "text/typescript-jsx",
      jsx: "text/jsx", sh: "text/x-shellscript", bat: "text/x-bat",
    };
    return { path: full, mime: mimeMap[ext] ?? "application/octet-stream" };
  }

  readText(subPath: string): string {
    const full = this.safePath(subPath);
    if (!existsSync(full)) throw new Error("File not found");
    const stat = statSync(full);
    if (stat.size > 5_242_880) throw new Error("File too large for text editor");
    return readFileSync(full, "utf-8");
  }

  writeText(subPath: string, content: string): void {
    const full = this.safePath(subPath);
    const dir = full.substring(0, full.lastIndexOf(sep));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(full, content, "utf-8");
  }

  rename(oldSubPath: string, newSubPath: string): void {
    const oldFull = this.safePath(oldSubPath);
    const newFull = this.safePath(newSubPath);
    if (!existsSync(oldFull)) throw new Error("Source not found");
    const dir = newFull.substring(0, newFull.lastIndexOf(sep));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    renameSync(oldFull, newFull);
  }

  delete(subPath: string): void {
    const full = this.safePath(subPath);
    if (!existsSync(full)) throw new Error("Path not found");
    const stat = statSync(full);
    if (stat.isDirectory()) {
      rmSync(full, { recursive: true, force: true });
    } else {
      unlinkSync(full);
    }
  }
}
