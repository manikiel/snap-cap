import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalDatabase } from "../src/data/db";
import { SimulationEngine } from "../src/data/engine";
import { createVault, unlockVault, encrypt, decrypt } from "../src/data/crypto";
import {
  exportBackup,
  validateBackup,
  restoreBackup,
} from "../src/data/backup";
import { id, type Account } from "../src/data/types";
let db: LocalDatabase, engine: SimulationEngine, now: number, account: Account;
beforeEach(async () => {
  db = new LocalDatabase(`test-${id()}`);
  now = Date.parse("2026-10-11T12:00:00Z");
  engine = new SimulationEngine(db, () => now);
  account = await engine.createAccount("Alex", "alex.local", true);
});
afterEach(async () => {
  await db.delete();
});
const photo = () =>
  engine.saveMedia(
    account.id,
    { type: "photo", title: "Test memory" },
    {
      blob: new Blob(["photo bytes"], { type: "image/jpeg" }),
      thumbnail: new Blob(["thumbnail"], { type: "image/jpeg" }),
    },
  );
describe("coherent local simulation", () => {
  it("creates optional demo data and isolates account records", async () => {
    expect(await db.users.count()).toBe(10);
    expect((await db.snapshot(account.id)).friends).toHaveLength(10);
    const other = await engine.createAccount("Robin", "robin.local", false);
    expect((await db.snapshot(other.id)).messages).toHaveLength(0);
    expect((await db.snapshot(account.id)).messages.length).toBeGreaterThan(10);
  });
  it("validates local profile names and usernames", async () => {
    await expect(engine.createAccount("", "xx")).rejects.toThrow();
    await expect(engine.createAccount("Alex", "<script>")).rejects.toThrow();
  });
  it("persists text, delivery, opened status, contextual replies and activities", async () => {
    const m = await engine.send(account.id, "maya", "text", "Coffee tomorrow?");
    expect((await db.messages.get(m.id))?.state).toBe("sent");
    now += 1000;
    await engine.tick(account.id);
    expect((await db.messages.get(m.id))?.state).toBe("delivered");
    now += 2000;
    await engine.tick(account.id);
    expect((await db.messages.get(m.id))?.state).toBe("opened");
    now += 6000;
    await engine.tick(account.id);
    const messages = await db.messages
      .where("[accountId+userId]")
      .equals([account.id, "maya"])
      .toArray();
    expect(
      messages.some(
        (x) => x.sender === "friend" && /café|coffee|cookies/i.test(x.text),
      ),
    ).toBe(true);
    expect((await db.accounts.get(account.id))?.sentTexts).toBe(1);
    expect((await db.accounts.get(account.id))?.achievements).toContain(
      "First hello",
    );
  });
  it("disables generated replies while preserving local delivery", async () => {
    await engine.updatePreferences(account.id, { simulation: false });
    const before = await db.messages.count();
    const message = await engine.send(account.id, "maya", "text", "Hello");
    now += 300000;
    await engine.tick(account.id);
    expect(await db.messages.count()).toBe(before + 1);
    expect((await db.messages.get(message.id))?.state).toBe("delivered");
  });
  it("blocks pending interactions and disallows sends", async () => {
    await engine.send(account.id, "maya", "text", "hello");
    await engine.setFriend(account.id, "maya", "blocked");
    expect(
      await db.events
        .where("accountId")
        .equals(account.id)
        .filter((e) => e.userId === "maya")
        .count(),
    ).toBe(0);
    await expect(engine.send(account.id, "maya", "text", "No")).rejects.toThrow(
      "Add this fictional friend",
    );
  });
  it("accepts and removes fictional friendships without losing history", async () => {
    await engine.setFriend(account.id, "evie", "friend");
    expect((await engine.requireFriend(account.id, "evie")).status).toBe(
      "friend",
    );
    const before = await db.messages.count();
    await engine.setFriend(account.id, "maya", "removed");
    expect(await db.messages.count()).toBe(before);
  });
  it("keeps snap counters and UTC-day streaks consistent", async () => {
    const media = await photo();
    await engine.sendSnap(account.id, ["maya", "leo"], media.id);
    expect((await db.accounts.get(account.id))?.score).toBe(2);
    now += 5000;
    await engine.tick(account.id);
    expect((await engine.requireFriend(account.id, "maya")).streak).toBe(1);
    await engine.sendSnap(account.id, ["maya"], media.id);
    now += 5000;
    await engine.tick(account.id);
    expect((await engine.requireFriend(account.id, "maya")).streak).toBe(1);
    now += 86400000;
    await engine.sendSnap(account.id, ["maya"], media.id);
    now += 5000;
    await engine.tick(account.id);
    expect((await engine.requireFriend(account.id, "maya")).streak).toBe(2);
    now += 172800000;
    await engine.tick(account.id);
    expect((await engine.requireFriend(account.id, "maya")).streak).toBe(0);
  });
  it("opens a received snap once, counts score once, and expires media access on close", async () => {
    const m = await db.messages
      .where("accountId")
      .equals(account.id)
      .filter((m) => m.kind === "snap")
      .first();
    expect(m).toBeTruthy();
    await engine.openSnap(account.id, m!.id);
    await engine.openSnap(account.id, m!.id);
    expect((await db.accounts.get(account.id))?.score).toBe(1);
    await engine.closeSnap(account.id, m!.id);
    expect((await db.messages.get(m!.id))?.expired).toBe(true);
    await expect(engine.openSnap(account.id, m!.id)).rejects.toThrow("expired");
  });
  it("retains viewed snaps for 24 hours when configured", async () => {
    await engine.updatePreferences(account.id, { retention: "24h" });
    const m = await db.messages
      .where("accountId")
      .equals(account.id)
      .filter((m) => m.kind === "snap")
      .first();
    await engine.openSnap(account.id, m!.id);
    await engine.closeSnap(account.id, m!.id);
    now += 1000;
    await engine.tick(account.id);
    expect((await db.messages.get(m!.id))?.expired).not.toBe(true);
    now += 86400000;
    await engine.tick(account.id);
    expect((await db.messages.get(m!.id))?.expired).toBe(true);
  });
  it("keeps forever snaps accessible until deletion", async () => {
    await engine.updatePreferences(account.id, { retention: "forever" });
    const m = await db.messages
      .where("accountId")
      .equals(account.id)
      .filter((m) => m.kind === "snap")
      .first();
    await engine.openSnap(account.id, m!.id);
    now += 172800000;
    await engine.closeSnap(account.id, m!.id);
    await engine.tick(account.id);
    expect((await db.messages.get(m!.id))?.expired).not.toBe(true);
  });
  it("marks received texts and notifications read", async () => {
    await engine.openChat(account.id, "maya");
    expect(
      await db.messages
        .where("[accountId+userId]")
        .equals([account.id, "maya"])
        .filter((m) => m.kind === "text" && m.unread)
        .count(),
    ).toBe(0);
  });
});
describe("media and Stories", () => {
  it("stores blobs, thumbnails and genuine media metadata", async () => {
    const media = await photo();
    expect((await db.payloads.get(media.id))?.blob).toBeInstanceOf(Blob);
    expect((await db.accounts.get(account.id))?.savedMedia).toBe(1);
  });
  it("rolls back quota failures without leaving metadata or counters", async () => {
    const before = await db.media.count();
    const score = (await db.accounts.get(account.id))!.savedMedia;
    const hook = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
    db.payloads.hook("creating", hook);
    await expect(photo()).rejects.toThrow("Storage full");
    db.payloads.hook("creating").unsubscribe(hook);
    expect(await db.media.count()).toBe(before);
    expect((await db.accounts.get(account.id))?.savedMedia).toBe(score);
  });
  it("publishes independent Story media, simulates custom viewers and expires after 24 hours", async () => {
    const media = await photo();
    const story = await engine.publishStory(account.id, [media.id], "custom", [
      "maya",
    ]);
    expect(story.items[0]).not.toBe(media.id);
    now += 20000;
    await engine.tick(account.id);
    expect((await db.stories.get(story.id))?.viewers).toEqual(["maya"]);
    now += 86400000;
    await engine.tick(account.id);
    expect((await db.stories.get(story.id))?.expired).toBe(true);
    expect(await db.media.get(media.id)).toBeTruthy();
    expect((await db.stories.get(story.id))?.items).toHaveLength(0);
  });
  it("does not simulate views of a private Story", async () => {
    const media = await photo();
    const story = await engine.publishStory(account.id, [media.id], "private");
    now += 30000;
    await engine.tick(account.id);
    expect((await db.stories.get(story.id))?.viewers).toHaveLength(0);
  });
  it("prevents private or foreign media from being sent", async () => {
    const media = await photo();
    await db.media.update(media.id, { private: true });
    await expect(
      engine.sendSnap(account.id, ["maya"], media.id),
    ).rejects.toThrow("unavailable");
    const other = await engine.createAccount("Robin", "robin.local", false);
    await expect(
      engine.publishStory(other.id, [media.id], "friends"),
    ).rejects.toThrow();
  });
  it("deletes media payloads and makes referenced snaps inaccessible", async () => {
    const media = await photo();
    const m = await engine.send(account.id, "maya", "snap", "Snap", media.id);
    await engine.deleteMedia(account.id, media.id);
    expect(await db.payloads.get(media.id)).toBeUndefined();
    expect((await db.messages.get(m.id))?.mediaId).toBeUndefined();
    expect((await db.messages.get(m.id))?.expired).toBe(true);
  });
});
describe("encrypted private Memories", () => {
  it("derives a non-extractable key, validates the PIN and authenticates ciphertext", async () => {
    const { vault, key } = await createVault("12345678");
    expect(key.extractable).toBe(false);
    expect(JSON.stringify(vault)).not.toContain("12345678");
    const unlocked = await unlockVault("12345678", vault);
    const payload = await encrypt(new Blob(["private moment"]), key);
    expect(await payload.blob.text()).not.toContain("private moment");
    expect(
      await (
        await decrypt(payload.blob, payload.iv, unlocked, "text/plain")
      ).text(),
    ).toBe("private moment");
    await expect(unlockVault("98765432", vault)).rejects.toThrow(
      "Incorrect PIN",
    );
    const bytes = new Uint8Array(await payload.blob.arrayBuffer());
    bytes[0] ^= 1;
    await expect(
      decrypt(new Blob([bytes]), payload.iv, key, "text/plain"),
    ).rejects.toThrow();
  });
});
describe("validated complete backups", () => {
  it("exports and restores all records and blobs without overwriting existing profiles", async () => {
    await photo();
    const blob = await exportBackup(db);
    const backup = validateBackup(JSON.parse(await blob.text()));
    const count = await db.messages.count();
    const restoredId = await restoreBackup(backup, db);
    expect(await db.accounts.count()).toBe(2);
    expect(await db.messages.count()).toBe(count * 2);
    expect(restoredId).not.toBe(account.id);
    expect((await db.accounts.get(restoredId!))?.name).toContain("restored");
    const restored = await db.media
      .where("accountId")
      .equals(restoredId!)
      .filter((m) => m.saved)
      .first();
    expect(await (await db.payloads.get(restored!.id))!.blob.text()).toBe(
      "photo bytes",
    );
  });
  it("rejects malformed, duplicate and dangling records before restoring", async () => {
    const backup = JSON.parse(await (await exportBackup(db)).text());
    backup.records.messages[0].mediaId = "does-not-exist";
    expect(() => validateBackup(backup)).toThrow("invalid");
    delete backup.records.messages[0].mediaId;
    backup.records.accounts.push(backup.records.accounts[0]);
    expect(() => validateBackup(backup)).toThrow("invalid");
    expect(await db.accounts.count()).toBe(1);
  });
  it("rejects unsupported backup versions and executable MIME payloads", async () => {
    expect(() =>
      validateBackup({ format: "snap-cap", version: 999 }),
    ).toThrow();
    const backup = JSON.parse(await (await exportBackup(db)).text());
    backup.payloads[0].mime = "text/html";
    expect(() => validateBackup(backup)).toThrow();
  });
});
