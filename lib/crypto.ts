import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for OAuth tokens at rest.
 *
 * HogFarm has to keep each user's refresh token so it can pull their analytics
 * back over time. Storing those in plaintext — especially in a shared database —
 * would be a real exposure, so we encrypt with a key held only in the
 * environment (HOGFARM_ENC_KEY), never in the database. Reading the DB without
 * the key yields nothing usable.
 */

function key(): Buffer {
  const hex = process.env.HOGFARM_ENC_KEY;
  if (!hex) throw new Error("HOGFARM_ENC_KEY is not set");
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decrypt(blob: string): string {
  const [ivB64, tagB64, dataB64] = blob.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
