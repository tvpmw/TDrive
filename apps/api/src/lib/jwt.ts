import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getEnv } from "../env.js";

interface TokenPayload extends JWTPayload {
  sub: string; // user ID
  jti: string; // unique token ID
}

const EXPIRY = "8h";

function getSecret() {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signToken(userId: string): Promise<{ token: string; csrfToken: string }> {
  const jti = crypto.randomUUID();
  const token = await new SignJWT({ sub: userId, jti } satisfies TokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());

  const csrfToken = crypto.randomUUID();
  return { token, csrfToken };
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (payload as TokenPayload).sub ?? null;
  } catch {
    return null;
  }
}
