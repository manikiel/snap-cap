import Dexie, { type Table } from "dexie";
import type {
  Account,
  User,
  Friendship,
  Message,
  Media,
  Payload,
  Story,
  Activity,
  SimEvent,
  Snapshot,
} from "./types";
export class LocalDatabase extends Dexie {
  accounts!: Table<Account>;
  users!: Table<User>;
  friends!: Table<Friendship>;
  messages!: Table<Message>;
  media!: Table<Media>;
  payloads!: Table<Payload>;
  stories!: Table<Story>;
  activities!: Table<Activity>;
  events!: Table<SimEvent>;
  constructor(name = "snap-cap-v1") {
    super(name);
    this.version(1).stores({
      accounts: "id",
      users: "id",
      friends: "id,accountId,[accountId+userId]",
      messages: "id,accountId,[accountId+userId],createdAt",
      media: "id,accountId",
      payloads: "id",
      stories: "id,accountId",
      activities: "id,accountId",
      events: "id,accountId,due",
    });
    // Binary records avoid Blob serialization failures in some WebKit builds.
    // Consumers receive normal Blobs; no media is encoded in localStorage.
    this.payloads.hook("reading", (payload) => {
      if (!payload) return payload;
      const stored = payload as unknown as StoredPayload;
      if (stored.blob instanceof ArrayBuffer)
        return {
          ...stored,
          blob: new Blob([stored.blob], { type: stored.mime }),
          thumbnail: stored.thumbnail
            ? new Blob([stored.thumbnail], { type: stored.thumbnailMime })
            : undefined,
        } as Payload;
      return payload;
    });
  }
  async readRawPayload(id: string) {
    return (await this.payloads
      .where("id")
      .equals(id)
      .raw()
      .first()) as unknown as StoredPayload | undefined;
  }
  addRawPayload(payload: StoredPayload, replace = false) {
    return replace
      ? this.payloads.put(payload as unknown as Payload)
      : this.payloads.add(payload as unknown as Payload);
  }
  async snapshot(accountId: string | null): Promise<Snapshot> {
    const accounts = await this.accounts.toArray();
    const account = accounts.find((a) => a.id === accountId);
    const users = await this.users.toArray();
    if (!account)
      return {
        accounts,
        users,
        friends: [],
        messages: [],
        media: [],
        stories: [],
        activities: [],
        events: [],
      };
    const [friends, messages, media, stories, activities, events] =
      await Promise.all(
        [
          this.friends,
          this.messages,
          this.media,
          this.stories,
          this.activities,
          this.events,
        ].map((t) => t.where("accountId").equals(account.id).toArray()),
      );
    return {
      account,
      accounts,
      users,
      friends,
      messages,
      media,
      stories,
      activities,
      events,
    } as Snapshot;
  }
}
export const db = new LocalDatabase();
export const accountKey = "snap-cap-active-profile";
export const storageError = (error: unknown) =>
  error instanceof Error && /quota/i.test(error.name + error.message)
    ? "Your device storage is full. Export a backup or remove some Memories, then try again."
    : "Could not save this change. Your existing records are still available. Please try again.";

export type StoredPayload = Omit<Payload, "blob" | "thumbnail"> & {
  blob: ArrayBuffer;
  thumbnail?: ArrayBuffer;
  mime: string;
  thumbnailMime?: string;
};
export async function serializePayload(
  payload: Payload,
): Promise<StoredPayload> {
  return {
    ...payload,
    blob: await payload.blob.arrayBuffer(),
    mime: payload.blob.type,
    thumbnail: payload.thumbnail
      ? await payload.thumbnail.arrayBuffer()
      : undefined,
    thumbnailMime: payload.thumbnail?.type,
  };
}
