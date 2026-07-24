import { Hono } from "hono";
import { authMiddleware, operatorMiddleware, type Variables } from "../middleware/auth.js";
import { LocalServerFiles } from "../services/server-files.js";
import { getEnv } from "../env.js";

const serverFiles = new Hono<{ Variables: Variables }>();
serverFiles.use("*", authMiddleware, operatorMiddleware);

const svc = () => new LocalServerFiles();

serverFiles.get("/status", (c) => {
  const env = getEnv();
  const s = svc().status();
  return c.json({ data: { ...s, root: env.SERVER_FILES_ROOT } });
});

serverFiles.get("/config", (c) => {
  const env = getEnv();
  return c.json({ data: { mode: env.SERVER_FILES_MODE, root: env.SERVER_FILES_ROOT } });
});

serverFiles.put("/config", async (c) => {
  const env = getEnv();
  return c.json({ data: { mode: env.SERVER_FILES_MODE, root: env.SERVER_FILES_ROOT } });
});

serverFiles.post("/config/test", (c) => {
  const s = svc().status();
  return c.json({ data: { ready: s.ready, mode: s.mode } });
});

serverFiles.get("/", (c) => {
  const path = c.req.query("path") ?? "";
  try {
    const files = svc().list(path);
    return c.json({ data: files });
  } catch (e: any) {
    return c.json({ error: "Error", message: e.message, statusCode: 500 }, 500);
  }
});

serverFiles.post("/folders", async (c) => {
  const body = await c.req.json<{ name: string; path?: string }>();
  if (!body.name?.trim()) {
    return c.json({ error: "Bad Request", message: "Folder name required", statusCode: 400 }, 400);
  }
  try {
    const parent = body.path ?? "";
    const subPath = parent ? `${parent}/${body.name.trim()}` : body.name.trim();
    svc().createFolder(subPath);
    return c.json({ data: { ok: true } });
  } catch (e: any) {
    return c.json({ error: "Error", message: e.message, statusCode: 500 }, 500);
  }
});

serverFiles.post("/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  const path = (body["path"] as string) ?? "";
  if (!file || !(file instanceof File)) {
    return c.json({ error: "Bad Request", message: "No file", statusCode: 400 }, 400);
  }
  try {
    const subPath = path ? `${path}/${file.name}` : file.name;
    const buffer = await file.arrayBuffer();
    await svc().upload(subPath, buffer);
    return c.json({ data: { ok: true, name: file.name, path: subPath } });
  } catch (e: any) {
    return c.json({ error: "Error", message: e.message, statusCode: 500 }, 500);
  }
});

serverFiles.get("/download", async (c) => {
  const path = c.req.query("path");
  if (!path) {
    return c.json({ error: "Bad Request", message: "path required", statusCode: 400 }, 400);
  }
  try {
    const s = new LocalServerFiles();
    const info = s.download(path);
    const { readFileSync } = await import("fs");
    const content = readFileSync(info.path);
    return new Response(content, {
      headers: {
        "Content-Type": info.mime,
        "Content-Disposition": `attachment; filename="${path.split("/").pop()}"`,
      },
    });
  } catch (e: any) {
    return c.json({ error: "Error", message: e.message, statusCode: 500 }, 500);
  }
});

serverFiles.get("/text", (c) => {
  const path = c.req.query("path");
  if (!path) {
    return c.json({ error: "Bad Request", message: "path required", statusCode: 400 }, 400);
  }
  try {
    const content = svc().readText(path);
    return c.json({ data: { content, path } });
  } catch (e: any) {
    return c.json({ error: "Error", message: e.message, statusCode: 500 }, 500);
  }
});

serverFiles.put("/text", async (c) => {
  const body = await c.req.json<{ path: string; content: string }>();
  if (!body.path) {
    return c.json({ error: "Bad Request", message: "path required", statusCode: 400 }, 400);
  }
  try {
    svc().writeText(body.path, body.content ?? "");
    return c.json({ data: { ok: true } });
  } catch (e: any) {
    return c.json({ error: "Error", message: e.message, statusCode: 500 }, 500);
  }
});

serverFiles.patch("/", async (c) => {
  const body = await c.req.json<{ path: string; newPath: string }>();
  if (!body.path || !body.newPath) {
    return c.json({ error: "Bad Request", message: "path and newPath required", statusCode: 400 }, 400);
  }
  try {
    svc().rename(body.path, body.newPath);
    return c.json({ data: { ok: true } });
  } catch (e: any) {
    return c.json({ error: "Error", message: e.message, statusCode: 500 }, 500);
  }
});

serverFiles.delete("/", async (c) => {
  const path = c.req.query("path");
  if (!path) {
    return c.json({ error: "Bad Request", message: "path required", statusCode: 400 }, 400);
  }
  try {
    svc().delete(path);
    return c.json({ data: { ok: true } });
  } catch (e: any) {
    return c.json({ error: "Error", message: e.message, statusCode: 500 }, 500);
  }
});

serverFiles.post("/import-to-drive", async (c) => {
  const body = await c.req.json<{ path: string; parentId?: string }>();
  if (!body.path) {
    return c.json({ error: "Bad Request", message: "path required", statusCode: 400 }, 400);
  }
  try {
    const s = new LocalServerFiles();
    const info = s.download(body.path);
    const { readFileSync } = await import("fs");
    const buffer = readFileSync(info.path);
    return c.json({ data: { content: Array.from(new Uint8Array(buffer)), name: body.path.split("/").pop() } });
  } catch (e: any) {
    return c.json({ error: "Error", message: e.message, statusCode: 500 }, 500);
  }
});

export default serverFiles;
