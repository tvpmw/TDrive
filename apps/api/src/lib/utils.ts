import { nanoid } from "nanoid";

export function newId(): string {
  return nanoid(21);
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    if (key) {
      cookies[key.trim()] = rest.join("=").trim();
    }
  }
  return cookies;
}
