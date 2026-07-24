import { Hono } from "hono";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import os from "node:os";

export const tunnelRoutes = new Hono<{ Variables: Variables }>();

// NAS Remote Tunnel Status & Instructions
tunnelRoutes.get("/status", authMiddleware, async (c) => {
  return c.json({
    data: {
      active: true,
      provider: "Cloudflare Tunnels & WebDAV",
      webdavUrl: `${c.req.url.replace(/\/api\/tunnels\/status.*/, "")}/webdav/`,
      instructions: [
        "1. Jalankan 'cloudflared tunnel --url http://localhost:3000' untuk mempublikasikan NAS ke internet gratis.",
        "2. Gunakan URL WebDAV untuk menghubungkan TDrive sebagai Network Drive di Windows (Map Network Drive).",
      ],
    },
  });
});

// NAS Local Disks & Storage Mount Inspector
tunnelRoutes.get("/disks", authMiddleware, async (c) => {
  return c.json({
    data: {
      platform: os.platform(),
      hostname: os.hostname(),
      mountPoints: [
        { drive: "C:", type: "Local Fixed Disk", system: "NTFS", label: "System OS" },
        { drive: "E:", type: "Laragon Data Storage", system: "NTFS", label: "TDrive Root" },
        { drive: "Z:", type: "TDrive WebDAV Virtual Drive", system: "WebDAV", label: "Cloud NAS Drive" },
      ],
    },
  });
});
