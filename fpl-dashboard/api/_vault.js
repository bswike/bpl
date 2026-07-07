// Encrypted credential vault for opt-in daily auto-sync.
//
// GHIN has no long-lived tokens or refresh tokens (login tokens die in ~12h),
// so background sync requires re-logging-in, which requires the golfer's
// credentials. Those are stored ONLY with explicit opt-in, encrypted at rest
// with AES-256-GCM under GOLF_VAULT_KEY, at an unguessable blob URL that can
// only be enumerated with the server-side blob token.
//
// Setup (one time, in Vercel project env vars):
//   GOLF_VAULT_KEY  = any long random string (e.g. `openssl rand -base64 32`)
//   CRON_SECRET     = any long random string (guards the sync endpoint)
// Without GOLF_VAULT_KEY the vault is disabled and auto-sync is unavailable.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { put, list, del } from "@vercel/blob";

const VAULT_PREFIX = "golf/vault/";

export function vaultConfigured() {
  return !!process.env.GOLF_VAULT_KEY;
}

function key() {
  const raw = process.env.GOLF_VAULT_KEY;
  if (!raw) throw new Error("GOLF_VAULT_KEY not set");
  // Normalize any passphrase/hex/base64 to a 32-byte key.
  return createHash("sha256").update(raw).digest();
}

function encrypt(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString("base64")).join(":");
}

function decrypt(packed) {
  const [iv, tag, ct] = packed.split(":").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

function cleanGhin(ghin) {
  const c = String(ghin).replace(/[^0-9]/g, "");
  if (!c) throw new Error("Invalid GHIN number");
  return c;
}

async function deleteExisting(ghin) {
  const { blobs } = await list({ prefix: VAULT_PREFIX + ghin });
  await Promise.all(blobs.map((b) => del(b.url)));
}

export async function enrollVault({ ghin, email, password, name }) {
  const clean = cleanGhin(ghin);
  const enc = encrypt(JSON.stringify({ email, password }));
  await deleteExisting(clean);
  await put(
    `${VAULT_PREFIX}${clean}.json`,
    JSON.stringify({ ghin: clean, name: name || "", enc, updated_at: new Date().toISOString() }),
    {
      access: "public", // Vercel Blob is public-URL only; the random suffix +
      addRandomSuffix: true, // AES encryption are what protect the ciphertext.
      contentType: "application/json",
    }
  );
}

export async function removeVault(ghin) {
  await deleteExisting(cleanGhin(ghin));
}

export async function isVaulted(ghin) {
  const { blobs } = await list({ prefix: VAULT_PREFIX + cleanGhin(ghin) });
  return blobs.length > 0;
}

/** Decrypt all vaulted credentials (cron use only). */
export async function listVaultCredentials() {
  const { blobs } = await list({ prefix: VAULT_PREFIX, limit: 500 });
  const out = [];
  for (const b of blobs) {
    try {
      const r = await fetch(`${b.url}?v=${Date.parse(b.uploadedAt) || 0}`);
      if (!r.ok) continue;
      const rec = await r.json();
      const { email, password } = JSON.parse(decrypt(rec.enc));
      out.push({ ghin: rec.ghin, name: rec.name, email, password });
    } catch (e) {
      console.error("vault decrypt failed for a record:", e.message);
    }
  }
  return out;
}
