import type { LocalDatabase } from "./db";
import { db, serializePayload } from "./db";
import {
  id,
  defaultAvatar,
  defaultPreferences,
  type Account,
  type Message,
  type Media,
  type Payload,
  type SimEvent,
  type Story,
  type Preferences,
} from "./types";
import { directory, seedChats, sceneSvg } from "./seed";
const day = (time: number) => new Date(time).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
export class SimulationEngine {
  constructor(
    public database: LocalDatabase = db,
    public now: () => number = Date.now,
  ) {}
  async createAccount(
    name: string,
    username: string,
    demo = true,
    avatar = defaultAvatar,
  ) {
    if (!name.trim() || !/^[a-zA-Z0-9._-]{3,24}$/.test(username))
      throw new Error(
        "Choose a name and a username of 3–24 letters, numbers, dots or underscores.",
      );
    const d = this.database;
    const account: Account = {
      id: id(),
      name: name.trim().slice(0, 60),
      username,
      bio: "",
      birthday: "",
      avatar,
      createdAt: this.now(),
      score: 0,
      sentSnaps: 0,
      sentTexts: 0,
      savedMedia: 0,
      preferences: { ...defaultPreferences, storyGroup: [] },
      achievements: [],
      collections: ["Camera roll", "Weekend", "Favourites"],
    };
    await d.transaction("rw", d.tables, async () => {
      await d.accounts.add(account);
      await d.users.bulkPut(directory);
      if (demo) await this.seed(account.id);
    });
    return account;
  }
  async seed(accountId: string) {
    const d = this.database;
    const now = this.now();
    const existing = await d.friends
      .where("accountId")
      .equals(accountId)
      .toArray();
    if (existing.length) return;
    for (const [index, user] of directory.entries()) {
      const friend = index < 6;
      await d.friends.add({
        id: id(),
        accountId,
        userId: user.id,
        status: friend ? "friend" : index === 6 ? "incoming" : "removed",
        since: now - (40 + index * 17) * 86400000,
        pinned: index === 0,
        notifications: true,
        wallpaper: "default",
        streak: 0,
        lastSentDay: "",
        lastReceivedDay: "",
        lastStreakDay: "",
        interactions: friend ? 6 - index : 0,
      });
      if (friend) {
        const texts = seedChats[user.id];
        for (const [j, text] of texts.entries())
          await d.messages.add({
            id: id(),
            accountId,
            userId: user.id,
            sender: "friend",
            kind: "text",
            text,
            createdAt: now - (index + 1) * 420000 - (texts.length - j) * 70000,
            state: "delivered",
            unread: j === texts.length - 1 && index < 3,
          });
        if (index < 4) {
          const mediaId = id();
          const blob = new Blob([sceneSvg(index)], { type: "image/svg+xml" });
          await d.media.add({
            id: mediaId,
            accountId,
            type: "photo",
            mime: blob.type,
            createdAt: now - index * 1500000,
            title: "An afternoon outside",
            collection: "",
            favourite: false,
            private: false,
            saved: false,
            width: 600,
            height: 1000,
            duration: 0,
            size: blob.size,
          });
          const bytes = new TextEncoder().encode(sceneSvg(index)).buffer;
          await d.addRawPayload({
            id: mediaId,
            blob: bytes,
            thumbnail: bytes,
            mime: blob.type,
            thumbnailMime: blob.type,
          });
          if (index === 1)
            await d.messages.add({
              id: id(),
              accountId,
              userId: user.id,
              sender: "friend",
              kind: "snap",
              text: "New Snap",
              mediaId,
              createdAt: now - 70000,
              state: "delivered",
              unread: true,
            });
          await d.stories.add({
            id: id(),
            accountId,
            userId: user.id,
            createdAt: now - index * 1500000,
            expiresAt: now + 86400000 - index * 1500000,
            items: [mediaId],
            viewedItems: [],
            visibility: "friends",
            group: [],
            viewers: [],
            expired: false,
          });
        }
      }
    }
    await this.activity(
      accountId,
      "request",
      "Evie Morgan sent you a fictional friend request.",
      "evie",
    );
    await d.events.add({
      id: id(),
      accountId,
      userId: "maya",
      type: "initiate",
      due: now + 120000,
      context: "Just walked past that café again. Still smells amazing ☕",
    });
  }
  async activity(
    accountId: string,
    type: "message" | "snap" | "story" | "request" | "achievement" | "call",
    text: string,
    userId?: string,
    storyId?: string,
  ) {
    const account = await this.database.accounts.get(accountId);
    if (
      account?.preferences.notifications ||
      type === "request" ||
      type === "achievement"
    )
      await this.database.activities.add({
        id: id(),
        accountId,
        type,
        text,
        userId,
        storyId,
        createdAt: this.now(),
        read: false,
      });
  }
  async updatePreferences(accountId: string, values: Partial<Preferences>) {
    const a = await this.database.accounts.get(accountId);
    if (a)
      await this.database.accounts.update(accountId, {
        preferences: { ...a.preferences, ...values },
      });
  }
  async requireFriend(accountId: string, userId: string) {
    const f = await this.database.friends
      .where("[accountId+userId]")
      .equals([accountId, userId])
      .first();
    if (!f || f.status !== "friend")
      throw new Error(
        "Add this fictional friend before starting a conversation.",
      );
    return f;
  }
  async send(
    accountId: string,
    userId: string,
    kind: Message["kind"],
    text: string,
    mediaId?: string,
    replyTo?: string,
  ) {
    const d = this.database;
    const now = this.now();
    const message: Message = {
      id: id(),
      accountId,
      userId,
      sender: "me",
      kind,
      text: text.trim().slice(0, 4000),
      mediaId,
      createdAt: now,
      state: "sent",
      replyTo,
      unread: false,
    };
    if (kind === "text" && !message.text)
      throw new Error("Write a message first.");
    await d.transaction("rw", d.tables, async () => {
      const f = await this.requireFriend(accountId, userId);
      if (mediaId) {
        const media = await d.media.get(mediaId);
        if (!media || media.accountId !== accountId || media.private)
          throw new Error("This media is unavailable.");
      }
      if (replyTo) {
        const original = await d.messages.get(replyTo);
        if (
          !original ||
          original.accountId !== accountId ||
          original.userId !== userId
        )
          throw new Error("The original message is no longer available.");
      }
      await d.messages.add(message);
      const a = await d.accounts.get(accountId);
      if (!a) throw new Error("Profile unavailable.");
      await d.friends.update(f.id, {
        interactions: f.interactions + 1,
        ...(kind === "snap" ? { lastSentDay: day(now) } : {}),
      });
      await d.accounts.update(accountId, {
        score: a.score + (kind === "snap" ? 1 : 0),
        sentSnaps: a.sentSnaps + (kind === "snap" ? 1 : 0),
        sentTexts: a.sentTexts + (kind === "text" ? 1 : 0),
      });
      const events: SimEvent[] = [
        {
          id: id(),
          accountId,
          userId,
          type: "delivered",
          messageId: message.id,
          due: now + 900,
          context: "",
        },
      ];
      if (a.preferences.simulation && kind !== "call")
        events.push(
          {
            id: id(),
            accountId,
            userId,
            type: "opened",
            messageId: message.id,
            due: now + 2300,
            context: "",
          },
          {
            id: id(),
            accountId,
            userId,
            type: "reply",
            messageId: message.id,
            due: now + 4500 + (f.interactions % 3) * 600,
            context: kind === "text" ? message.text : kind,
          },
        );
      await d.events.bulkAdd(events);
      await this.achievements(accountId);
    });
    return message;
  }
  async sendSnap(accountId: string, users: string[], mediaId: string) {
    const d = this.database;
    await d.transaction("rw", d.tables, async () => {
      const media = await d.media.get(mediaId);
      const payload = await d.readRawPayload(mediaId);
      if (!media || !payload || media.private || media.accountId !== accountId)
        throw new Error("Snap unavailable.");
      const copyId = id();
      await d.media.add({
        ...media,
        id: copyId,
        saved: false,
        favourite: false,
        collection: "",
        title: "Sent snap",
      });
      await d.addRawPayload({ ...payload, id: copyId });
      if (!users.length) throw new Error("Choose at least one recipient.");
      for (const user of new Set(users))
        await this.send(accountId, user, "snap", "Snap", copyId);
    });
  }
  reply(context: string, userId: string, count: number) {
    const user = directory.find((u) => u.id === userId);
    const name = user?.interest || "weekend";
    const lower = context.toLowerCase();
    if (/\b(hi|hey|hello)\b/.test(lower))
      return [
        "Hey! How’s your day going?",
        "Hey you ☀️ I was just taking a break.",
        "Hi! Good timing, I just got home.",
      ][count % 3];
    if (/coffee|café|cafe/.test(lower))
      return [
        "Absolutely. Same little café near the station? ☕",
        "A coffee and a long walk sounds perfect.",
        "Yes! I’m still thinking about those cookies.",
      ][count % 3];
    if (/\b(when|time|tomorrow|saturday)\b/.test(lower))
      return [
        "How about around 3? I’m free after lunch.",
        "Tomorrow works for me. Let’s keep it relaxed.",
        "Saturday afternoon? I’ll bring something to share.",
      ][count % 3];
    if (/\b(thanks|thank you)\b/.test(lower))
      return "Of course! Glad it helped 😊";
    if (/snap|voice/.test(lower))
      return [
        "Love this! Thanks for sharing ✨",
        "That made me smile. More little moments like this please.",
        "Okay, this is such a good vibe.",
      ][count % 3];
    if (context.includes("?"))
      return [
        `I think so! Let me check after I finish this ${name} break.`,
        `I’m up for it. What did you have in mind?`,
        `That sounds good to me! Tell me more.`,
      ][count % 3];
    return [
      `That sounds lovely. I’ve been doing a bit of ${name} today.`,
      `I get what you mean. It’s been that kind of day here too.`,
      `Honestly, same 😄 What are you up to next?`,
      `I’m glad you told me. We should catch up properly soon.`,
    ][count % 4];
  }
  async tick(accountId: string) {
    const d = this.database;
    const now = this.now();
    await d.transaction("rw", d.tables, async () => {
      const account = await d.accounts.get(accountId);
      if (!account) return;
      const events = (
        await d.events.where("accountId").equals(accountId).toArray()
      )
        .filter((e) => e.due <= now)
        .sort((a, b) => a.due - b.due);
      for (const e of events) {
        await d.events.delete(e.id);
        const f = await d.friends
          .where("[accountId+userId]")
          .equals([accountId, e.userId])
          .first();
        if (f?.status !== "friend") continue;
        const message = e.messageId
          ? await d.messages.get(e.messageId)
          : undefined;
        if ((e.type === "delivered" || e.type === "opened") && !message)
          continue;
        if (e.type === "delivered" && message?.state === "sent")
          await d.messages.update(message.id, { state: "delivered" });
        if (e.type === "opened" && account.preferences.simulation && message) {
          await d.messages.update(message.id, {
            state: "opened",
            ...(message.kind === "snap" ? { viewedAt: now } : {}),
          });
          if (message.kind === "snap") {
            const today = day(now);
            let streak = f.streak;
            if (f.lastSentDay === today && f.lastStreakDay !== today)
              streak =
                f.lastStreakDay && dayDiff(today, f.lastStreakDay) === 1
                  ? streak + 1
                  : 1;
            await d.friends.update(f.id, {
              lastReceivedDay: today,
              lastStreakDay: today,
              streak,
            });
            await this.activity(
              accountId,
              "snap",
              "Your snap was opened in the local simulation.",
              e.userId,
            );
          }
        }
        if (
          ((e.type === "reply" && message) || e.type === "initiate") &&
          account.preferences.simulation
        ) {
          const count = await d.messages
            .where("[accountId+userId]")
            .equals([accountId, e.userId])
            .count();
          await d.messages.add({
            id: id(),
            accountId,
            userId: e.userId,
            sender: "friend",
            kind: "text",
            text:
              e.type === "initiate"
                ? e.context
                : this.reply(e.context, e.userId, count),
            createdAt: now,
            state: "delivered",
            unread: true,
          });
          if (e.type === "initiate")
            await d.events.add({
              id: id(),
              accountId,
              userId: e.userId,
              type: "initiate",
              due: now + 300000,
              context: [
                "How’s your afternoon going?",
                "Found another little place for our next walk.",
                "Hope your day’s going well ☀️",
              ][count % 3],
            });
          if (f.notifications)
            await this.activity(
              accountId,
              "message",
              `${directory.find((u) => u.id === e.userId)?.name.split(" ")[0]} sent a fictional message.`,
              e.userId,
            );
        }
        if (
          e.type === "story-view" &&
          account.preferences.simulation &&
          e.storyId
        ) {
          const story = await d.stories.get(e.storyId);
          if (
            story &&
            !story.expired &&
            story.expiresAt > now &&
            story.visibility !== "private" &&
            (story.visibility === "friends" || story.group.includes(e.userId))
          ) {
            await d.stories.update(story.id, {
              viewers: [...new Set([...story.viewers, e.userId])],
            });
            await this.activity(
              accountId,
              "story",
              "A fictional friend viewed your Story.",
              e.userId,
              story.id,
            );
          }
        }
      }
      for (const s of await d.stories
        .where("accountId")
        .equals(accountId)
        .toArray())
        if (!s.expired && s.expiresAt <= now)
          await d.stories.update(s.id, { expired: true, items: [] });
      const removed = new Set<string>();
      const messages = await d.messages
        .where("accountId")
        .equals(accountId)
        .toArray();
      for (const m of messages) {
        if (
          m.kind === "snap" &&
          !m.expired &&
          m.viewedAt &&
          (account.preferences.retention === "opened" ||
            (account.preferences.retention === "24h" &&
              now - m.viewedAt >= 86400000))
        )
          await d.messages.update(m.id, { expired: true, mediaId: undefined });
        if (
          account.preferences.retention === "24h" &&
          m.kind !== "snap" &&
          m.state === "opened" &&
          now - m.createdAt >= 86400000
        )
          removed.add(m.id);
      }
      if (removed.size) {
        await d.messages.bulkDelete([...removed]);
        for (const m of messages)
          if (m.replyTo && removed.has(m.replyTo) && !removed.has(m.id))
            await d.messages.update(m.id, { replyTo: undefined });
        await d.events
          .where("accountId")
          .equals(accountId)
          .filter((e) => !!e.messageId && removed.has(e.messageId))
          .delete();
      }
      for (const f of await d.friends
        .where("accountId")
        .equals(accountId)
        .toArray())
        if (
          f.lastStreakDay &&
          dayDiff(day(now), f.lastStreakDay) > 1 &&
          f.streak
        )
          await d.friends.update(f.id, { streak: 0 });
      await this.collectMedia(accountId);
    });
  }
  async collectMedia(accountId: string) {
    const d = this.database;
    const refs = new Set([
      ...(await d.messages.where("accountId").equals(accountId).toArray()).map(
        (m) => m.mediaId,
      ),
      ...(
        await d.stories.where("accountId").equals(accountId).toArray()
      ).flatMap((s) => s.items),
    ]);
    for (const media of await d.media
      .where("accountId")
      .equals(accountId)
      .toArray())
      if (
        !media.saved &&
        !refs.has(media.id) &&
        this.now() - media.createdAt > 3600000
      ) {
        await d.media.delete(media.id);
        await d.payloads.delete(media.id);
      }
  }
  async openChat(accountId: string, userId: string) {
    await this.database.messages
      .where("[accountId+userId]")
      .equals([accountId, userId])
      .filter((m) => m.sender === "friend" && m.kind !== "snap")
      .modify({ unread: false, state: "opened" });
    await this.database.activities
      .where("accountId")
      .equals(accountId)
      .filter((n) => n.userId === userId)
      .modify({ read: true });
  }
  async openSnap(accountId: string, messageId: string) {
    const d = this.database;
    return d.transaction("rw", d.messages, d.accounts, d.friends, async () => {
      // Read inside the write transaction so concurrent taps only score once.
      const m = await d.messages.get(messageId);
      if (!m || m.accountId !== accountId || m.expired || !m.mediaId)
        throw new Error("This snap has expired.");
      const now = this.now();
      await d.messages.update(m.id, {
        viewedAt: m.viewedAt ?? now,
        state: "opened",
        unread: false,
      });
      if (m.sender === "friend" && m.viewedAt === undefined) {
        const a = await d.accounts.get(accountId);
        if (a) await d.accounts.update(accountId, { score: a.score + 1 });
        const f = await d.friends
          .where("[accountId+userId]")
          .equals([accountId, m.userId])
          .first();
        if (f) await d.friends.update(f.id, { lastReceivedDay: day(now) });
      }
      return m.mediaId;
    });
  }
  async closeSnap(accountId: string, messageId: string) {
    const a = await this.database.accounts.get(accountId);
    const m = await this.database.messages.get(messageId);
    if (m?.accountId === accountId && a?.preferences.retention === "opened")
      await this.database.messages.update(messageId, {
        expired: true,
        mediaId: undefined,
      });
  }
  async setFriend(
    accountId: string,
    userId: string,
    status: "friend" | "incoming" | "requested" | "removed" | "blocked",
  ) {
    const d = this.database;
    await d.transaction("rw", d.tables, async () => {
      const f = await d.friends
        .where("[accountId+userId]")
        .equals([accountId, userId])
        .first();
      if (f) await d.friends.update(f.id, { status });
      else
        await d.friends.add({
          id: id(),
          accountId,
          userId,
          status,
          since: this.now(),
          pinned: false,
          notifications: true,
          wallpaper: "default",
          streak: 0,
          lastSentDay: "",
          lastReceivedDay: "",
          lastStreakDay: "",
          interactions: 0,
        });
      if (status === "blocked" || status === "removed")
        await d.events
          .where("accountId")
          .equals(accountId)
          .filter((e) => e.userId === userId)
          .delete();
      if (status === "requested")
        await this.activity(
          accountId,
          "request",
          "Your local friend request is waiting for acceptance.",
          userId,
        );
    });
  }
  async saveMedia(
    accountId: string,
    meta: Partial<Media>,
    payload: Omit<Payload, "id">,
  ) {
    const d = this.database;
    const media: Media = {
      id: id(),
      accountId,
      type: meta.type || "photo",
      mime: payload.blob.type,
      createdAt: this.now(),
      title: meta.title || "New memory",
      collection: meta.collection || "Camera roll",
      favourite: false,
      private: false,
      saved: meta.saved ?? true,
      width: meta.width || 0,
      height: meta.height || 0,
      duration: meta.duration || 0,
      size: payload.blob.size,
      ...meta,
    };
    const serialized = await serializePayload({ ...payload, id: media.id });
    await d.transaction(
      "rw",
      d.media,
      d.payloads,
      d.accounts,
      d.activities,
      async () => {
        await d.media.add(media);
        await d.addRawPayload(serialized);
        if (media.saved) {
          const a = await d.accounts.get(accountId);
          if (a)
            await d.accounts.update(accountId, {
              savedMedia: a.savedMedia + 1,
            });
          await this.achievements(accountId);
        }
      },
    );
    return media;
  }
  async remember(accountId: string, mediaId: string) {
    const d = this.database;
    await d.transaction("rw", d.media, d.accounts, d.activities, async () => {
      const m = await d.media.get(mediaId);
      if (m?.accountId !== accountId) throw new Error("Media unavailable.");
      if (!m.saved) {
        await d.media.update(mediaId, {
          saved: true,
          collection: "Camera roll",
        });
        const a = await d.accounts.get(accountId);
        if (a)
          await d.accounts.update(accountId, { savedMedia: a.savedMedia + 1 });
        await this.achievements(accountId);
      }
    });
  }
  async deleteMedia(accountId: string, mediaId: string) {
    const d = this.database;
    await d.transaction("rw", d.tables, async () => {
      if ((await d.media.get(mediaId))?.accountId !== accountId)
        throw new Error("Media unavailable.");
      await d.media.delete(mediaId);
      await d.payloads.delete(mediaId);
      await d.messages
        .where("accountId")
        .equals(accountId)
        .filter((m) => m.mediaId === mediaId)
        .modify({ expired: true, mediaId: undefined });
      for (const s of await d.stories
        .where("accountId")
        .equals(accountId)
        .toArray())
        if (s.items.includes(mediaId))
          await d.stories.update(s.id, {
            items: s.items.filter((i) => i !== mediaId),
          });
    });
  }
  async publishStory(
    accountId: string,
    mediaIds: string[],
    visibility: Story["visibility"],
    group: string[] = [],
  ) {
    if (!mediaIds.length) throw new Error("Select a photo or video.");
    const d = this.database;
    const now = this.now();
    const story: Story = {
      id: id(),
      accountId,
      userId: "me",
      createdAt: now,
      expiresAt: now + 86400000,
      items: mediaIds,
      viewedItems: [],
      visibility,
      group,
      viewers: [],
      expired: false,
    };
    await d.transaction("rw", d.tables, async () => {
      for (const mediaId of mediaIds) {
        const media = await d.media.get(mediaId);
        if (
          !media ||
          media.accountId !== accountId ||
          media.private ||
          media.type === "audio"
        )
          throw new Error(
            "A Story can only include your available photos and videos.",
          );
      }
      const copies: string[] = [];
      for (const sourceId of mediaIds) {
        const source = await d.media.get(sourceId);
        const payload = await d.readRawPayload(sourceId);
        if (!source || !payload) throw new Error("Story media is unavailable.");
        const copyId = id();
        await d.media.add({
          ...source,
          id: copyId,
          saved: false,
          private: false,
          collection: "",
          title: "Story snap",
        });
        await d.addRawPayload({ ...payload, id: copyId });
        copies.push(copyId);
      }
      story.items = copies;
      await d.stories.add(story);
      const friends = await d.friends
        .where("accountId")
        .equals(accountId)
        .filter(
          (f) =>
            f.status === "friend" &&
            (visibility === "friends" ||
              (visibility === "custom" && group.includes(f.userId))),
        )
        .toArray();
      await d.events.bulkAdd(
        friends.map((f, i) => ({
          id: id(),
          accountId,
          userId: f.userId,
          type: "story-view" as const,
          due: now + 8000 + i * 6000,
          storyId: story.id,
          context: "",
        })),
      );
    });
    return story;
  }
  async achievements(accountId: string) {
    const d = this.database;
    const a = await d.accounts.get(accountId);
    if (!a) return;
    const unlocks = [
      a.sentTexts >= 1 ? "First hello" : "",
      a.sentSnaps >= 1 ? "First snap" : "",
      a.savedMedia >= 1 ? "Memory keeper" : "",
      a.sentSnaps >= 10 ? "Ten little moments" : "",
    ].filter((x) => x && !a.achievements.includes(x));
    if (unlocks.length) {
      await d.accounts.update(accountId, {
        achievements: [...a.achievements, ...unlocks],
      });
      for (const achievement of unlocks)
        await this.activity(
          accountId,
          "achievement",
          `Achievement unlocked: ${achievement}`,
        );
    }
  }
}
export const engine = new SimulationEngine();
