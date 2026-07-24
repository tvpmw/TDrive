/**
  * Zero-Knowledge Client-Side Encryption Utility for TDrive
  * Uses Web Crypto API (AES-256-GCM) with PBKDF2 key derivation.
  */

export async function deriveKey(passphrase: string, saltHex: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = hexToBuffer(saltHex);
  
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBuffer(buffer: ArrayBuffer, passphrase: string): Promise<{ ciphertext: ArrayBuffer; ivHex: string; saltHex: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const saltHex = bufferToHex(salt.buffer);
  const ivHex = bufferToHex(iv.buffer);
  
  const key = await deriveKey(passphrase, saltHex);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    buffer
  );

  return { ciphertext, ivHex, saltHex };
}

export async function decryptBuffer(ciphertext: ArrayBuffer, passphrase: string, ivHex: string, saltHex: string): Promise<ArrayBuffer> {
  const iv = hexToBuffer(ivHex);
  const key = await deriveKey(passphrase, saltHex);
  
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    ciphertext
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes.buffer;
}
