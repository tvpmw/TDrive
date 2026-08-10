/**
 * Ekstraksi teks dari file untuk pencarian dalam konten (extracted_text).
 * Self-contained: tidak butuh dependency eksternal.
 * - .txt/.md/.csv/.json/.log/.code → langsung
 * - .pdf → parse stream (regex Tj/TJ)
 * - .docx → mini ZIP reader (zlib bawaan) + parse document.xml
 */
import { inflateRawSync } from "node:zlib";

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "csv", "json", "log", "xml", "yml", "yaml", "ini", "conf",
  "sh", "js", "ts", "tsx", "jsx", "css", "html", "htm", "py", "go", "rs",
  "java", "c", "cpp", "h", "sql", "toml", "env", "gitignore", "svg", "srt", "vtt",
]);

export function getExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isTextual(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext);
}

// Ekstrak teks dari PDF (regex sederhana — cukup untuk sebagian besar PDF text-based)
function extractPdfText(buf: Buffer): string {
  try {
    // PDF stream content biasanya pakai Latin-1
    const raw = buf.toString("latin1");
    const parts: string[] = [];

    // Pola: (teks) Tj  dan  [(teks) -20 (teks)] TJ
    const textOps = raw.match(/\((?:[^()\\]|\\.)*\)\s*Tj|\[(?:[^\[\]]*)\]\s*TJ/g) ?? [];
    for (const op of textOps) {
      const parens = op.match(/\(((?:[^()\\]|\\.)*)\)/g);
      if (!parens) continue;
      const line = parens.map((p) => {
        let s = p.slice(1, -1);
        s = s.replace(/\\([()\\])/g, "$1").replace(/\\n/g, " ").replace(/\\r/g, " ");
        return s;
      }).join("");
      if (line.trim()) parts.push(line.trim());
    }

    // Fallback: coba inflate stream jika tidak ada teks plain
    if (parts.length === 0) {
      const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)];
      for (const m of streams.slice(0, 10)) {
        try {
          const inflated = inflateRawSync(Buffer.from(m[1], "latin1")).toString("utf-8");
          const t = extractPdfText(Buffer.from(inflated, "utf-8"));
          if (t.trim()) parts.push(t);
        } catch {}
      }
    }
    return parts.join("\n").slice(0, 200_000);
  } catch {
    return "";
  }
}

// Mini ZIP reader: ambil entry tertentu (mis. word/document.xml dari DOCX)
function readZipEntry(buf: Buffer, targetName: string): Buffer | null {
  try {
    const eocd = buf.lastIndexOf(Buffer.from("PK\x05\x06"));
    if (eocd < 0) return null;
    const totalEntries = buf.readUInt16LE(eocd + 10);
    const cdSize = buf.readUInt32LE(eocd + 12);
    const cdOffset = buf.readUInt32LE(eocd + 16);

    let pos = cdOffset;
    for (let i = 0; i < totalEntries; i++) {
      const sig = buf.readUInt32LE(pos);
      if (sig !== 0x02014b50) break;
      const method = buf.readUInt16LE(pos + 10);
      const compSize = buf.readUInt32LE(pos + 20);
      const uncompSize = buf.readUInt32LE(pos + 24);
      const nameLen = buf.readUInt16LE(pos + 28);
      const extraLen = buf.readUInt16LE(pos + 30);
      const commentLen = buf.readUInt16LE(pos + 32);
      const localOffset = buf.readUInt32LE(pos + 42);
      const name = buf.slice(pos + 46, pos + 46 + nameLen).toString("utf-8");
      if (name === targetName) {
        // Local file header
        const local = localOffset;
        const lNameLen = buf.readUInt16LE(local + 26);
        const lExtraLen = buf.readUInt16LE(local + 28);
        const dataStart = local + 30 + lNameLen + lExtraLen;
        const data = buf.slice(dataStart, dataStart + compSize);
        if (method === 0) return data;
        if (method === 8) return inflateRawSync(data);
        return null;
      }
      pos += 46 + nameLen + extraLen + commentLen;
    }
  } catch {}
  return null;
}

function extractDocxText(buf: Buffer): string {
  try {
    const xml = readZipEntry(buf, "word/document.xml");
    if (!xml) return "";
    const text = xml.toString("utf-8")
      .replace(/<w:p[^>]*>/g, "\n")   // akhir paragraf → newline
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n");
    // Satu pass: ambil isi <w:t>…</w:t>, hilangkan tag lain
    const cleaned = text.replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return cleaned.join("\n").slice(0, 200_000);
  } catch {
    return "";
  }
}

// Public entry: ekstrak teks dari buffer file
export function extractText(name: string, buf: Buffer): string {
  const ext = getExtension(name);
  try {
    if (isTextual(ext)) {
      const text = buf.toString("utf-8");
      // Validasi: jika banyak karakter aneh (bukan teks), jangan simpan
      if (text.length > 0) return text.slice(0, 200_000);
      return "";
    }
    if (ext === "pdf") return extractPdfText(buf);
    if (ext === "docx") return extractDocxText(buf);
    // txt/doc/dot lama tidak didukung tanpa library
    return "";
  } catch {
    return "";
  }
}
