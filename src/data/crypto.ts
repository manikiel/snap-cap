import { db, serializePayload } from "./db";
import type { Vault } from "./types";
export const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768)
    s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
};
export const fromBase64 = (s: string) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const buffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
async function derive(pin: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: buffer(salt), iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encrypt(blob: Blob, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: buffer(iv) },
    key,
    await blob.arrayBuffer(),
  );
  return {
    blob: new Blob([bytes], { type: "application/octet-stream" }),
    iv: toBase64(iv),
  };
}
export async function decrypt(
  blob: Blob,
  iv: string,
  key: CryptoKey,
  mime: string,
) {
  return new Blob(
    [
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: buffer(fromBase64(iv)) },
        key,
        await blob.arrayBuffer(),
      ),
    ],
    { type: mime },
  );
}
export async function createVault(
  pin: string,
): Promise<{ vault: Vault; key: CryptoKey }> {
  if (!/^\d{6,12}$/.test(pin))
    throw new Error("Use a PIN with 6–12 digits. A longer PIN is stronger.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 600000;
  const key = await derive(pin, salt, iterations);
  const check = await encrypt(new Blob(["snap-cap-vault-v1"]), key);
  return {
    key,
    vault: {
      salt: toBase64(salt),
      iterations,
      iv: check.iv,
      check: toBase64(new Uint8Array(await check.blob.arrayBuffer())),
    },
  };
}
export async function unlockVault(pin: string, vault: Vault) {
  try {
    const key = await derive(pin, fromBase64(vault.salt), vault.iterations);
    const check = await decrypt(
      new Blob([buffer(fromBase64(vault.check))]),
      vault.iv,
      key,
      "text/plain",
    );
    if ((await check.text()) !== "snap-cap-vault-v1") throw new Error();
    return key;
  } catch {
    throw new Error("Incorrect PIN. Your private Memories remain locked.");
  }
}
export async function movePrivate(
  accountId: string,
  mediaId: string,
  key: CryptoKey,
  makePrivate: boolean,
) {
  const media = await db.media.get(mediaId);
  const payload = await db.payloads.get(mediaId);
  if (!media || !payload || media.accountId !== accountId)
    throw new Error("Memory unavailable.");
  let next;
  if (makePrivate) {
    const encrypted = await encrypt(payload.blob, key);
    const thumbnail = payload.thumbnail
      ? await encrypt(payload.thumbnail, key)
      : undefined;
    next = {
      id: mediaId,
      blob: encrypted.blob,
      iv: encrypted.iv,
      thumbnail: thumbnail?.blob,
      thumbIv: thumbnail?.iv,
    };
  } else {
    if (!payload.iv) throw new Error("Invalid encrypted memory.");
    next = {
      id: mediaId,
      blob: await decrypt(payload.blob, payload.iv, key, media.mime),
      thumbnail:
        payload.thumbnail && payload.thumbIv
          ? await decrypt(payload.thumbnail, payload.thumbIv, key, "image/jpeg")
          : undefined,
    };
  }
  const serialized = await serializePayload(next);
  await db.transaction("rw", db.media, db.payloads, async () => {
    await db.addRawPayload(serialized, true);
    await db.media.update(mediaId, {
      private: makePrivate,
      title: makePrivate ? "Private memory" : "Unlocked memory",
      collection: makePrivate ? "My Eyes Only" : "Camera roll",
    });
  });
}
