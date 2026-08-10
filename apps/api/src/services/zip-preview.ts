/**
 * ZIP preview — parser central directory tanpa dependency eksternal.
 * Membaca daftar isi archive (nama, ukuran, compression) tanpa mengekstrak.
 */
export interface ZipEntryInfo {
  name: string;
  size: number;
  compressedSize: number;
  isDirectory: boolean;
  compressionMethod: number; // 0 = stored, 8 = deflate
}

function readUInt16LE(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset);
}

function readUInt32LE(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}

/**
 * Parsing ZIP via End of Central Directory (EOCD) + Central Directory File Headers.
 * Tidak memerlukan zlib untuk listing — hanya offset/panjang.
 */
export function parseZipEntries(buf: Buffer): ZipEntryInfo[] {
  if (!buf || buf.length < 22) return [];

  // Cari EOCD signature (PK\x05\x06) dari belakang
  const eocdSig = 0x06054b50;
  let eocdOffset = -1;
  const searchStart = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === eocdSig) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return [];

  const entryCount = readUInt16LE(buf, eocdOffset + 10);
  const cdSize = readUInt32LE(buf, eocdOffset + 12);
  const cdOffset = readUInt32LE(buf, eocdOffset + 16);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) return []; // ZIP64 — unsupported di listing sederhana

  const entries: ZipEntryInfo[] = [];
  let pos = cdOffset;
  const cdEnd = cdOffset + cdSize;
  const sig = 0x02014b50;

  let parsed = 0;
  while (pos + 46 <= cdEnd && pos + 46 <= buf.length && parsed < Math.min(entryCount, 10000)) {
    if (buf.readUInt32LE(pos) !== sig) break;

    const compressionMethod = readUInt16LE(buf, pos + 10);
    const compressedSize = readUInt32LE(buf, pos + 20);
    const uncompressedSize = readUInt32LE(buf, pos + 24);
    const nameLen = readUInt16LE(buf, pos + 28);
    const extraLen = readUInt16LE(buf, pos + 30);
    const commentLen = readUInt16LE(buf, pos + 32);
    const externalAttrs = readUInt32LE(buf, pos + 38);

    const nameBuf = buf.subarray(pos + 46, pos + 46 + nameLen);
    let name = "";
    try {
      // ZIP umumnya UTF-8 bila flag bit 11 diset; fallback latin1
      name = nameBuf.toString("utf8");
      if (name.includes("\ufffd")) name = nameBuf.toString("latin1");
    } catch {
      name = nameBuf.toString("latin1");
    }

    const isDirectory = name.endsWith("/") || (uncompressedSize === 0 && (externalAttrs & 0x10) !== 0);
    entries.push({
      name: name.replace(/\/+$/, "") || name,
      size: uncompressedSize,
      compressedSize,
      isDirectory,
      compressionMethod,
    });

    pos += 46 + nameLen + extraLen + commentLen;
    parsed++;
  }

  return entries;
}

/**
 * Ringkasan ringkas untuk UI: total entri, total ukuran terkompresi vs asli.
 */
export function summarizeZip(buf: Buffer) {
  const entries = parseZipEntries(buf);
  const files = entries.filter((e) => !e.isDirectory);
  const totalUncompressed = files.reduce((sum, e) => sum + e.size, 0);
  const totalCompressed = files.reduce((sum, e) => sum + e.compressedSize, 0);
  return { entries, fileCount: files.length, totalUncompressed, totalCompressed };
}
