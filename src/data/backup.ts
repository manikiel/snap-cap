import { db, type LocalDatabase } from "./db";
import { id, type Account } from "./types";
import { toBase64, fromBase64 } from "./crypto";
export const tables = [
  "accounts",
  "users",
  "friends",
  "messages",
  "media",
  "stories",
  "activities",
  "events",
] as const;
export type Backup = {
  format: "snap-cap";
  version: 1;
  createdAt: number;
  records: Record<(typeof tables)[number], Record<string, unknown>[]>;
  payloads: {
    id: string;
    mime: string;
    data: string;
    thumbnail?: string;
    thumbnailMime?: string;
    iv?: string;
    thumbIv?: string;
  }[];
};
const limit = 48 * 1024 * 1024;
export async function exportBackup(database: LocalDatabase = db) {
  const snapshot = await database.transaction(
    "r",
    database.tables,
    async () => {
      const records = {} as Backup["records"];
      for (const table of tables)
        records[table] = await database.table(table).toArray();
      return { records, payloads: await database.payloads.toArray() };
    },
  );
  const { records, payloads } = snapshot;
  const bytes = payloads.reduce(
    (n, p) => n + p.blob.size + (p.thumbnail?.size || 0),
    0,
  );
  if (bytes > 32 * 1024 * 1024)
    throw new Error(
      "Your media exceeds the 32 MB JSON backup limit. Export large videos individually from Memories first.",
    );
  const backup: Backup = {
    format: "snap-cap",
    version: 1,
    createdAt: Date.now(),
    records,
    payloads: [],
  };
  for (const p of payloads) {
    backup.payloads.push({
      id: p.id,
      mime: p.blob.type,
      data: toBase64(new Uint8Array(await p.blob.arrayBuffer())),
      thumbnail: p.thumbnail
        ? toBase64(new Uint8Array(await p.thumbnail.arrayBuffer()))
        : undefined,
      thumbnailMime: p.thumbnail?.type,
      iv: p.iv,
      thumbIv: p.thumbIv,
    });
    await new Promise((r) => setTimeout(r, 0));
  }
  const result = new Blob([JSON.stringify(backup)], {
    type: "application/json",
  });
  if (result.size > limit)
    throw new Error(
      "This backup exceeds the 48 MB file limit. Export large media individually first.",
    );
  return result;
}
const string = (x: unknown, max = 4000): x is string =>
  typeof x === "string" && x.length <= max;
const number = (x: unknown) =>
  typeof x === "number" && Number.isFinite(x) && x >= 0;
const enumValue = (x: unknown, values: string[]) =>
  string(x) && values.includes(x);
const arrayStrings = (x: unknown) =>
  Array.isArray(x) && x.length <= 10000 && x.every((v) => string(v, 100));
function avatar(x: unknown) {
  if (!x || typeof x !== "object") return false;
  const a = x as Record<string, unknown>;
  return (
    ["skin", "hair", "shirt", "background"].every(
      (k) => string(a[k], 7) && /^#[0-9a-f]{6}$/i.test(a[k] as string),
    ) &&
    enumValue(a.style, ["crop", "waves", "long", "bun"]) &&
    enumValue(a.eyes, ["round", "happy", "sleepy"]) &&
    enumValue(a.accessory, ["none", "glasses", "earrings"])
  );
}
export function validateBackup(value: unknown): Backup {
  const fail = () => {
    throw new Error(
      "This backup is invalid or uses an unsupported format. No data was changed.",
    );
  };
  if (!value || typeof value !== "object") return fail();
  const b = value as Backup;
  if (
    b.format !== "snap-cap" ||
    b.version !== 1 ||
    !number(b.createdAt) ||
    !b.records ||
    !Array.isArray(b.payloads) ||
    b.payloads.length > 10000
  )
    return fail();
  let total = 0;
  for (const name of tables) {
    const rows = b.records[name];
    if (!Array.isArray(rows) || rows.length > 50000) return fail();
    const ids = new Set();
    for (const r of rows) {
      if (
        !r ||
        typeof r !== "object" ||
        !string(r.id, 100) ||
        !r.id ||
        ids.has(r.id) ||
        Object.keys(r).includes("__proto__")
      )
        return fail();
      ids.add(r.id);
      if (name !== "users" && name !== "accounts" && !string(r.accountId, 100))
        return fail();
    }
  }
  const accounts = new Set(b.records.accounts.map((r) => r.id));
  const users = new Set(b.records.users.map((r) => r.id));
  const media = new Set(b.records.media.map((r) => r.id));
  const messages = new Set(b.records.messages.map((r) => r.id));
  for (const a of b.records.accounts) {
    const p = a.preferences as Record<string, unknown>;
    if (
      !string(a.name, 60) ||
      !string(a.username, 24) ||
      !string(a.bio) ||
      !string(a.birthday, 10) ||
      !number(a.createdAt) ||
      !number(a.score) ||
      !number(a.sentTexts) ||
      !number(a.sentSnaps) ||
      !number(a.savedMedia) ||
      !avatar(a.avatar) ||
      !arrayStrings(a.achievements) ||
      !arrayStrings(a.collections) ||
      !p ||
      !enumValue(p.theme, ["system", "light", "dark"]) ||
      !enumValue(p.retention, ["opened", "24h", "forever"]) ||
      !enumValue(p.storyVisibility, ["friends", "private", "custom"]) ||
      !enumValue(p.friendVisibility, ["friends", "private"]) ||
      !arrayStrings(p.storyGroup) ||
      typeof p.simulation !== "boolean" ||
      typeof p.notifications !== "boolean" ||
      typeof p.reducedMotion !== "boolean" ||
      typeof p.textSize !== "number" ||
      p.textSize < 1 ||
      p.textSize > 1.5
    )
      return fail();
    if (a.vault) {
      const v = a.vault as Record<string, unknown>;
      if (
        !string(v.salt, 64) ||
        !string(v.iv, 32) ||
        !string(v.check, 1000) ||
        v.iterations !== 600000
      )
        return fail();
      try {
        if (
          fromBase64(v.salt as string).length !== 16 ||
          fromBase64(v.iv as string).length !== 12
        )
          return fail();
      } catch {
        return fail();
      }
    }
  }
  for (const u of b.records.users)
    if (
      !string(u.name, 60) ||
      !string(u.username, 24) ||
      !string(u.bio) ||
      !string(u.birthday, 10) ||
      !string(u.interest, 50) ||
      !number(u.persona) ||
      !avatar(u.avatar)
    )
      return fail();
  for (const name of tables.filter((n) => n !== "accounts" && n !== "users"))
    for (const r of b.records[name]) {
      if (!accounts.has(r.accountId)) return fail();
      if (r.userId && r.userId !== "me" && !users.has(r.userId)) return fail();
      if (
        name === "friends" &&
        (!enumValue(r.status, [
          "friend",
          "incoming",
          "requested",
          "removed",
          "blocked",
        ]) ||
          !number(r.since) ||
          !number(r.streak) ||
          !number(r.interactions) ||
          typeof r.pinned !== "boolean" ||
          typeof r.notifications !== "boolean" ||
          !enumValue(r.wallpaper, ["default", "dots", "sunset", "night"]) ||
          !string(r.lastSentDay, 10) ||
          !string(r.lastReceivedDay, 10) ||
          !string(r.lastStreakDay, 10))
      )
        return fail();
      if (
        name === "messages" &&
        (!enumValue(r.kind, ["text", "snap", "voice", "call"]) ||
          !enumValue(r.sender, ["me", "friend"]) ||
          !enumValue(r.state, ["sent", "delivered", "opened"]) ||
          !string(r.text) ||
          !number(r.createdAt) ||
          typeof r.unread !== "boolean" ||
          (r.mediaId && !media.has(r.mediaId)) ||
          (r.replyTo && !messages.has(r.replyTo)) ||
          (r.reaction && !string(r.reaction, 16)))
      )
        return fail();
      if (
        name === "media" &&
        (!enumValue(r.type, ["photo", "video", "audio"]) ||
          !string(r.mime, 100) ||
          !string(r.title, 120) ||
          !string(r.collection, 100) ||
          typeof r.saved !== "boolean" ||
          typeof r.private !== "boolean" ||
          typeof r.favourite !== "boolean" ||
          !["createdAt", "width", "height", "duration", "size"].every((k) =>
            number(r[k]),
          ))
      )
        return fail();
      if (
        name === "stories" &&
        (!arrayStrings(r.items) ||
          !(r.items as string[]).every((x) => media.has(x)) ||
          !arrayStrings(r.viewedItems) ||
          !arrayStrings(r.group) ||
          !arrayStrings(r.viewers) ||
          !enumValue(r.visibility, ["friends", "private", "custom"]) ||
          !number(r.createdAt) ||
          !number(r.expiresAt) ||
          typeof r.expired !== "boolean")
      )
        return fail();
      if (
        name === "activities" &&
        (!enumValue(r.type, [
          "message",
          "snap",
          "story",
          "request",
          "achievement",
          "call",
        ]) ||
          !string(r.text) ||
          !number(r.createdAt) ||
          typeof r.read !== "boolean")
      )
        return fail();
      if (
        name === "events" &&
        (!enumValue(r.type, [
          "delivered",
          "opened",
          "reply",
          "initiate",
          "story-view",
        ]) ||
          !number(r.due) ||
          !string(r.context) ||
          (r.messageId && !messages.has(r.messageId)))
      )
        return fail();
    }
  const byMedia = new Map(b.records.media.map((m) => [m.id, m]));
  const byMessage = new Map(b.records.messages.map((m) => [m.id, m]));
  const byStory = new Map(b.records.stories.map((s) => [s.id, s]));
  for (const m of b.records.messages) {
    if (
      (m.mediaId && byMedia.get(m.mediaId)?.accountId !== m.accountId) ||
      (m.replyTo &&
        (byMessage.get(m.replyTo)?.accountId !== m.accountId ||
          byMessage.get(m.replyTo)?.userId !== m.userId))
    )
      return fail();
  }
  for (const s of b.records.stories) {
    if (
      !(s.items as string[]).every(
        (mid) =>
          byMedia.get(mid)?.accountId === s.accountId &&
          !byMedia.get(mid)?.private,
      )
    )
      return fail();
    if (
      !(s.group as string[]).every((uid) => users.has(uid)) ||
      !(s.viewers as string[]).every((uid) => users.has(uid))
    )
      return fail();
  }
  for (const e of b.records.events) {
    if (
      (e.messageId && byMessage.get(e.messageId)?.accountId !== e.accountId) ||
      (e.storyId && byStory.get(e.storyId)?.accountId !== e.accountId)
    )
      return fail();
  }
  const payloadIds = new Set();
  for (const p of b.payloads) {
    if (
      !p ||
      !string(p.id, 100) ||
      payloadIds.has(p.id) ||
      !media.has(p.id) ||
      !string(p.mime, 100) ||
      !string(p.data, limit) ||
      !/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        p.data,
      )
    )
      return fail();
    try {
      if (
        (p.iv && fromBase64(p.iv).length !== 12) ||
        (p.thumbIv && fromBase64(p.thumbIv).length !== 12)
      )
        return fail();
    } catch {
      return fail();
    }
    payloadIds.add(p.id);
    total += p.data.length + (p.thumbnail?.length || 0);
    if (total > limit) return fail();
    const meta = byMedia.get(p.id);
    if (
      meta?.private &&
      (!p.iv ||
        (!p.thumbIv && p.thumbnail) ||
        p.mime !== "application/octet-stream")
    )
      return fail();
    if (
      !meta?.private &&
      !/^(image\/(jpeg|png|webp|gif|svg\+xml)|video\/(mp4|webm)|audio\/(mp4|webm|ogg))/.test(
        p.mime,
      )
    )
      return fail();
    if (
      p.thumbnail &&
      (!string(p.thumbnail, limit) ||
        !/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
          p.thumbnail,
        ))
    )
      return fail();
  }
  if ([...media].some((m) => !payloadIds.has(m))) return fail();
  return b;
}
export async function readBackup(file: File) {
  if (file.size > limit) throw new Error("Choose a backup smaller than 48 MB.");
  return validateBackup(JSON.parse(await file.text()));
}
// Restore adds new local profiles; existing IDs and records are never overwritten.
export async function restoreBackup(
  backup: Backup,
  database: LocalDatabase = db,
) {
  const b = validateBackup(backup);
  const maps = new Map<string, string>();
  for (const name of tables.filter((n) => n !== "users"))
    for (const r of b.records[name]) maps.set(r.id as string, id());
  const remap = (v: unknown) => (typeof v === "string" ? maps.get(v) || v : v);
  const rows = (name: (typeof tables)[number]) =>
    b.records[name].map((r) => {
      const out = { ...r };
      for (const k of [
        "id",
        "accountId",
        "mediaId",
        "messageId",
        "storyId",
        "replyTo",
      ])
        if (out[k]) out[k] = remap(out[k]);
      for (const k of ["items", "viewedItems"])
        if (Array.isArray(out[k])) out[k] = (out[k] as unknown[]).map(remap);
      if (name === "accounts") out.name = `${r.name} · restored`.slice(0, 60);
      return out;
    });
  await database.transaction("rw", database.tables, async () => {
    for (const name of tables) {
      if (name === "users") {
        for (const u of b.records.users)
          if (!(await database.users.get(u.id as string)))
            await database.users.add(u as never);
      } else await database.table(name).bulkAdd(rows(name));
    }
    for (const p of b.payloads) {
      const bytes = fromBase64(p.data);
      const thumb = p.thumbnail ? fromBase64(p.thumbnail) : undefined;
      await database.addRawPayload({
        id: remap(p.id) as string,
        blob: bytes.buffer as ArrayBuffer,
        mime: p.mime,
        thumbnailMime: p.thumbnailMime,
        thumbnail: thumb ? (thumb.buffer as ArrayBuffer) : undefined,
        iv: p.iv,
        thumbIv: p.thumbIv,
      });
    }
  });
  return maps.get(b.records.accounts[0]?.id as string);
}
