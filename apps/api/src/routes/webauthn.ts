import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../db/index.js";
import { users } from "../db/schema/users.js";
import { webauthnCredentials, webauthnChallenges } from "../db/schema/webauthn.js";
import { eq, and, lt, gt, desc } from "drizzle-orm";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { newId } from "../lib/utils.js";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";

const webauthn = new Hono<{ Variables: Variables }>();

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 menit

/** Derive rpID + origin dari request. localhost => rpID "localhost". */
function getRpInfo(c: any): { rpID: string; origin: string } {
  const forwardedHost = c.req.header("x-forwarded-host") || c.req.header("host") || "localhost";
  const proto = c.req.header("x-forwarded-proto") || "http";
  // Strip port untuk rpID (WebAuthn rpID tidak boleh berisi port)
  const rpID = forwardedHost.split(":")[0];
  const origin = `${proto}://${forwardedHost}`;
  return { rpID, origin };
}

async function clearExpiredChallenges(userId: string) {
  await db.delete(webauthnChallenges)
    .where(and(eq(webauthnChallenges.userId, userId), lt(webauthnChallenges.expiresAt, new Date())))
    .catch(() => {});
}

// 1. Mulai registrasi passkey
webauthn.post("/register/begin", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { rpID } = getRpInfo(c);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: "Not Found" }, 404);

  await clearExpiredChallenges(userId);
  const existing = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));

  const options: PublicKeyCredentialCreationOptionsJSON = await generateRegistrationOptions({
    rpName: "TDrive",
    rpID,
    userName: user.email,
    userDisplayName: user.email,
    attestationType: "none",
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    excludeCredentials: existing.map((cred) => ({ id: cred.credentialId })),
  });

  await db.insert(webauthnChallenges).values({
    id: newId(),
    userId,
    challenge: options.challenge,
    kind: "registration",
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });

  return c.json({ data: options });
});

// 2. Selesaikan registrasi (verifikasi attestation)
webauthn.post("/register/complete", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { rpID, origin } = getRpInfo(c);
  const body = await c.req.json<{ response: any }>();

  const [challengeRow] = await db.select().from(webauthnChallenges)
    .where(and(
      eq(webauthnChallenges.userId, userId),
      eq(webauthnChallenges.kind, "registration"),
      gt(webauthnChallenges.expiresAt, new Date())
    ))
    .orderBy(desc(webauthnChallenges.createdAt))
    .limit(1);

  if (!challengeRow) {
    return c.json({ error: "Bad Request", message: "Challenge tidak valid atau kedaluwarsa", statusCode: 400 }, 400);
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return c.json({ error: "Verification Failed", message: "Registrasi gagal diverifikasi", statusCode: 400 }, 400);
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    await db.insert(webauthnCredentials).values({
      id: newId(),
      userId,
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: JSON.stringify(credential.transports ?? []),
    });

    await db.delete(webauthnChallenges).where(eq(webauthnChallenges.id, challengeRow.id));

    return c.json({ data: { ok: true, credentialId: credential.id, credentialDeviceType, credentialBackedUp } }, 201);
  } catch (err: any) {
    return c.json({ error: "Verification Failed", message: err?.message || "Registrasi gagal", statusCode: 400 }, 400);
  }
});

// 3. Daftar passkey user
webauthn.get("/credentials", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const creds = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
  return c.json({ data: creds });
});

// 4. Hapus passkey
webauthn.delete("/credentials/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  await db.delete(webauthnCredentials)
    .where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.userId, userId)));
  return c.body(null, 204);
});

// 5. Mulai unlock vault (authentication challenge)
webauthn.post("/unlock/begin", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { rpID } = getRpInfo(c);
  await clearExpiredChallenges(userId);

  const creds = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
  if (creds.length === 0) {
    return c.json({ error: "Not Found", message: "Belum ada passkey terdaftar", statusCode: 404 }, 404);
  }

  const options: PublicKeyCredentialRequestOptionsJSON = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((cred) => ({
      id: cred.credentialId,
      transports: (JSON.parse(cred.transports || "[]")) as any[],
    })),
    userVerification: "preferred",
  });

  await db.insert(webauthnChallenges).values({
    id: newId(),
    userId,
    challenge: options.challenge,
    kind: "authentication",
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });

  return c.json({ data: options });
});

// 6. Selesaikan unlock (verifikasi assertion)
webauthn.post("/unlock/complete", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { rpID, origin } = getRpInfo(c);
  const body = await c.req.json<{ response: any }>();

  const [challengeRow] = await db.select().from(webauthnChallenges)
    .where(and(
      eq(webauthnChallenges.userId, userId),
      eq(webauthnChallenges.kind, "authentication"),
      gt(webauthnChallenges.expiresAt, new Date())
    ))
    .orderBy(desc(webauthnChallenges.createdAt))
    .limit(1);

  if (!challengeRow) {
    return c.json({ error: "Bad Request", message: "Challenge tidak valid atau kedaluwarsa", statusCode: 400 }, 400);
  }

  const credentialId = body.response?.id;
  const [storedCred] = await db.select().from(webauthnCredentials)
    .where(and(eq(webauthnCredentials.userId, userId), eq(webauthnCredentials.credentialId, credentialId)))
    .limit(1);

  if (!storedCred) {
    return c.json({ error: "Not Found", message: "Passkey tidak ditemukan", statusCode: 404 }, 404);
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCred.credentialId,
        publicKey: isoBase64URL.toBuffer(storedCred.publicKey),
        counter: storedCred.counter,
        transports: JSON.parse(storedCred.transports || "[]"),
      },
    });

    if (!verification.verified) {
      return c.json({ error: "Verification Failed", message: "Autentikasi gagal", statusCode: 400 }, 400);
    }

    await db.update(webauthnCredentials).set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(webauthnCredentials.id, storedCred.id));
    await db.delete(webauthnChallenges).where(eq(webauthnChallenges.id, challengeRow.id));

    return c.json({ data: { verified: true, vaultUnlocked: true } });
  } catch (err: any) {
    return c.json({ error: "Verification Failed", message: err?.message || "Autentikasi gagal", statusCode: 400 }, 400);
  }
});

export default webauthn;
