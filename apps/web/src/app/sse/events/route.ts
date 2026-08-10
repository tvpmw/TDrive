import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxy SSE dari API Hono.
 * Next.js rewrites menambahkan gzip yang mem-buffer streaming sehingga EventSource
 * tidak menerima event — route handler ini meneruskan stream tanpa kompresi.
 */
export async function GET(request: NextRequest) {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3003";

  const cookie = request.headers.get("cookie") || "";

  const upstream = await fetch(`${api}/api/sse/events`, {
    headers: {
      cookie,
      accept: "text/event-stream",
    },
    // Hindari kompresi & buffering upstream
    cache: "no-store",
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
