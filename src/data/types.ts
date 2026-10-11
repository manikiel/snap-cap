export type ID = string;
export type AvatarSpec = {
  skin: string;
  hair: string;
  style: "crop" | "waves" | "long" | "bun";
  eyes: "round" | "happy" | "sleepy";
  shirt: string;
  accessory: "none" | "glasses" | "earrings";
  background: string;
};
export type Preferences = {
  theme: "system" | "light" | "dark";
  textSize: number;
  reducedMotion: boolean;
  simulation: boolean;
  notifications: boolean;
  friendVisibility: "friends" | "private";
  storyVisibility: "friends" | "private" | "custom";
  storyGroup: string[];
  retention: "opened" | "24h" | "forever";
};
export type Vault = {
  salt: string;
  iv: string;
  check: string;
  iterations: number;
};
export type Account = {
  id: ID;
  name: string;
  username: string;
  bio: string;
  birthday: string;
  avatar: AvatarSpec;
  createdAt: number;
  score: number;
  sentSnaps: number;
  sentTexts: number;
  savedMedia: number;
  preferences: Preferences;
  vault?: Vault;
  achievements: string[];
  collections: string[];
};
export type User = {
  id: ID;
  name: string;
  username: string;
  bio: string;
  birthday: string;
  avatar: AvatarSpec;
  interest: string;
  persona: number;
};
export type Friendship = {
  id: ID;
  accountId: ID;
  userId: ID;
  status: "friend" | "incoming" | "requested" | "removed" | "blocked";
  since: number;
  pinned: boolean;
  notifications: boolean;
  wallpaper: string;
  streak: number;
  lastSentDay: string;
  lastReceivedDay: string;
  lastStreakDay: string;
  interactions: number;
};
export type MessageKind = "text" | "snap" | "voice" | "call";
export type Message = {
  id: ID;
  accountId: ID;
  userId: ID;
  sender: "me" | "friend";
  kind: MessageKind;
  text: string;
  mediaId?: ID;
  createdAt: number;
  state: "sent" | "delivered" | "opened";
  replyTo?: ID;
  reaction?: string;
  viewedAt?: number;
  expired?: boolean;
  unread: boolean;
};
export type Media = {
  id: ID;
  accountId: ID;
  type: "photo" | "video" | "audio";
  mime: string;
  createdAt: number;
  title: string;
  collection: string;
  favourite: boolean;
  private: boolean;
  saved: boolean;
  width: number;
  height: number;
  duration: number;
  size: number;
};
export type Payload = {
  id: ID;
  blob: Blob;
  thumbnail?: Blob;
  iv?: string;
  thumbIv?: string;
};
export type Story = {
  id: ID;
  accountId: ID;
  userId: "me" | ID;
  createdAt: number;
  expiresAt: number;
  items: ID[];
  viewedItems: ID[];
  visibility: "friends" | "private" | "custom";
  group: ID[];
  viewers: ID[];
  expired: boolean;
};
export type Activity = {
  id: ID;
  accountId: ID;
  userId?: ID;
  type: "message" | "snap" | "story" | "request" | "achievement" | "call";
  text: string;
  createdAt: number;
  read: boolean;
  storyId?: ID;
};
export type SimEvent = {
  id: ID;
  accountId: ID;
  userId: ID;
  type: "delivered" | "opened" | "reply" | "initiate" | "story-view";
  due: number;
  messageId?: ID;
  storyId?: ID;
  context: string;
};
export type Snapshot = {
  account?: Account;
  accounts: Account[];
  users: User[];
  friends: Friendship[];
  messages: Message[];
  media: Media[];
  stories: Story[];
  activities: Activity[];
  events: SimEvent[];
};
export const defaultAvatar: AvatarSpec = {
  skin: "#d7a077",
  hair: "#34241d",
  style: "waves",
  eyes: "happy",
  shirt: "#4669d8",
  accessory: "none",
  background: "#ded8fc",
};
export const defaultPreferences: Preferences = {
  theme: "system",
  textSize: 1,
  reducedMotion: false,
  simulation: true,
  notifications: true,
  friendVisibility: "friends",
  storyVisibility: "friends",
  storyGroup: [],
  retention: "opened",
};
export const id = () => crypto.randomUUID();
