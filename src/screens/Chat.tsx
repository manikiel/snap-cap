import { useEffect, useRef, useState } from "react";
import {
  MessageSquarePlus,
  Bell,
  Camera,
  Phone,
  Video,
  Mic,
  Send,
  ChevronRight,
  Pin,
  Check,
  Square,
  ArrowUpRight,
  Reply,
  X,
  MoreHorizontal,
  Trash2,
  Volume2,
} from "lucide-react";
import { useApp } from "../hooks/app";
import { engine } from "../data/engine";
import { db } from "../data/db";
import type { Message } from "../data/types";
import { recorderType } from "../data/media";
import { Avatar } from "../components/Avatar";
import {
  Header,
  SearchBox,
  IconButton,
  Sheet,
  Confirm,
  timeAgo,
  Empty,
} from "../components/ui";
import { useMediaUrl } from "../hooks/media";
import { MediaView } from "../components/MediaView";
export function ChatInbox() {
  const { data, open } = useApp();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const friends = data.friends
    .filter((f) => f.status === "friend")
    .map((f) => ({
      friend: f,
      user: data.users.find((u) => u.id === f.userId)!,
      last: data.messages
        .filter((m) => m.userId === f.userId)
        .sort((a, b) => b.createdAt - a.createdAt)[0],
    }))
    .filter(
      (x) =>
        x.user &&
        `${x.user.name} ${x.user.username}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter !== "Unread" ||
          data.messages.some((m) => m.userId === x.user.id && m.unread)) &&
        (filter !== "Best Friends" || x.friend.interactions >= 3),
    )
    .sort(
      (a, b) =>
        Number(b.friend.pinned) - Number(a.friend.pinned) ||
        (b.last?.createdAt || 0) - (a.last?.createdAt || 0),
    );
  return (
    <section className="page inbox">
      <Header title="Chat" back={false}>
        <IconButton
          label="Notifications"
          onClick={() => open({ name: "notifications" })}
        >
          <Bell />
          {data.activities.some((a) => !a.read) && <i className="badge-dot" />}
        </IconButton>
        <IconButton label="New chat" onClick={() => open({ name: "friends" })}>
          <MessageSquarePlus />
        </IconButton>
      </Header>
      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search chats"
      />
      <div className="filter-chips">
        {["All", "Unread", "Best Friends"].map((t) => (
          <button
            className={filter === t ? "active" : ""}
            key={t}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="scroll-content">
        {friends.map(({ friend, user, last }) => {
          const unread = data.messages.some(
            (m) => m.userId === user.id && m.unread,
          );
          return (
            <div className={`chat-row ${unread ? "unread" : ""}`} key={user.id}>
              <button
                className="avatar-button"
                aria-label={`${user.name} friendship profile`}
                onClick={() => open({ name: "friend", id: user.id })}
              >
                <Avatar spec={user.avatar} />
                {data.stories.some(
                  (s) => s.userId === user.id && !s.expired,
                ) && <i className="avatar-story-ring" />}
              </button>
              <button
                className="chat-row-main"
                onClick={() => open({ name: "conversation", id: user.id })}
              >
                <b>
                  {user.name} {friend.pinned && <Pin size={12} />}{" "}
                  {friend.interactions >= 3 && (
                    <span className="friend-emoji">💛</span>
                  )}{" "}
                  {friend.streak > 0 && (
                    <span className="streak">🔥 {friend.streak}</span>
                  )}
                </b>
                <span
                  className={`chat-preview ${last?.kind === "snap" ? "snap-state" : ""}`}
                >
                  <StatusIcon message={last} />
                  <span className="preview-text">
                    {last
                      ? last.kind === "snap"
                        ? last.expired
                          ? "Opened"
                          : last.sender === "friend"
                            ? "New Snap"
                            : last.state === "opened"
                              ? "Opened"
                              : last.state === "delivered"
                                ? "Delivered"
                                : "Sent"
                        : last.sender === "me"
                          ? last.state === "opened"
                            ? "Opened"
                            : last.state === "delivered"
                              ? "Delivered"
                              : "Sent"
                          : last.text.length > 34
                            ? last.text.slice(0, 34) + "…"
                            : last.text
                      : "Tap to chat"}
                  </span>
                  <i>·</i>
                  <small>{last ? timeAgo(last.createdAt) : "Say hello"}</small>
                </span>
              </button>
              <IconButton
                label={`Send snap to ${user.name}`}
                onClick={() => open({ name: "conversation", id: user.id })}
              >
                <Camera size={22} />
              </IconButton>
            </div>
          );
        })}
        {!friends.length && (
          <Empty
            icon={<MessageSquarePlus />}
            title={
              search || filter !== "All"
                ? "No chats here"
                : "Say your first hello"
            }
          >
            Find fictional friends from your profile to start a local
            conversation.
          </Empty>
        )}
        <p className="inbox-note">
          Fictional friends · Messages stay on this device
        </p>
      </div>
    </section>
  );
}
function StatusIcon({ message }: { message?: Message }) {
  if (!message) return <MessageSquarePlus size={13} />;
  const colour = message.kind === "snap" ? "#f33b57" : "#129bea";
  return message.sender === "friend" && message.unread ? (
    <Square size={12} fill={colour} stroke={colour} />
  ) : message.state === "opened" ? (
    <Square size={12} stroke={colour} />
  ) : (
    <ArrowUpRight size={13} color={colour} />
  );
}
function VoicePlayer({ id }: { id: string }) {
  const url = useMediaUrl(id);
  return url ? (
    <audio className="voice-player" src={url} controls preload="metadata" />
  ) : (
    <span>Loading voice message…</span>
  );
}
export function Conversation({ id }: { id: string }) {
  const { data, open, back, home, run, toast } = useApp();
  const account = data.account!;
  const user = data.users.find((u) => u.id === id);
  const friend = data.friends.find((f) => f.userId === id);
  const messages = data.messages
    .filter((m) => m.userId === id)
    .sort((a, b) => a.createdAt - b.createdAt);
  const [limit, setLimit] = useState(100);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<Message | null>(null);
  const [context, setContext] = useState<Message | null>(null);
  const [settings, setSettings] = useState(false);
  const [confirm, setConfirm] = useState<"clear" | "delete" | null>(null);
  const [snap, setSnap] = useState<Message | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressPoint = useRef({ x: 0, y: 0 });
  const recorder = useRef<MediaRecorder | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const cancelVoice = useRef(false);
  const voiceActive = useRef(true);
  const voicePending = useRef(false);
  const start = useRef(0);
  const voiceDuration = useRef(0);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    void run(() => engine.openChat(account.id, id));
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [messages.length, id]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const duration = (Date.now() - start.current) / 1000;
      setElapsed(duration);
      if (duration >= 60) finishVoice(false);
    }, 200);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    voiceActive.current = true;
    return () => {
      voiceActive.current = false;
      cancelVoice.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      mic.current?.getTracks().forEach((t) => t.stop());
      if (press.current) clearTimeout(press.current);
    };
  }, []);
  if (!user)
    return (
      <Empty icon={<MessageSquarePlus />} title="Friend unavailable">
        This fictional profile is no longer available.
      </Empty>
    );
  const typing = data.events.some(
    (e) =>
      e.userId === id &&
      e.type === "reply" &&
      e.due - Date.now() < 2200 &&
      account.preferences.simulation,
  );
  const allowed = friend?.status === "friend";
  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    const result = await run(() =>
      engine.send(account.id, id, "text", text, undefined, reply?.id),
    );
    if (result) {
      setText("");
      setReply(null);
      input.current?.focus();
    }
    setSending(false);
  }
  async function viewSnap(m: Message) {
    const result = await run(() => engine.openSnap(account.id, m.id));
    if (result) setSnap(m);
  }
  async function closeSnap() {
    if (snap) await run(() => engine.closeSnap(account.id, snap.id));
    setSnap(null);
  }
  async function startVoice() {
    if (voicePending.current || recorder.current?.state === "recording") return;
    if (
      !allowed ||
      !navigator.mediaDevices?.getUserMedia ||
      !globalThis.MediaRecorder
    ) {
      toast("Voice recording is unavailable in this browser.");
      return;
    }
    voicePending.current = true;
    await run(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!voiceActive.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mic.current = stream;
      cancelVoice.current = false;
      const type = recorderType(true);
      let r: MediaRecorder;
      try {
        r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      } catch (error) {
        stream.getTracks().forEach((t) => t.stop());
        throw error;
      }
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (cancelVoice.current || !voiceActive.current) return;
        const blob = new Blob(chunks, { type: r.mimeType });
        await run(async () => {
          const media = await engine.saveMedia(
            account.id,
            {
              type: "audio",
              saved: false,
              title: "Voice message",
              duration: voiceDuration.current,
            },
            { blob },
          );
          await engine.send(account.id, id, "voice", "Voice message", media.id);
        });
      };
      r.onerror = () => {
        cancelVoice.current = true;
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        toast("Voice recording failed. Please try again.");
      };
      recorder.current = r;
      start.current = Date.now();
      setElapsed(0);
      try {
        r.start(250);
      } catch (error) {
        stream.getTracks().forEach((t) => t.stop());
        throw error;
      }
      setRecording(true);
    });
    voicePending.current = false;
  }
  function finishVoice(cancel: boolean) {
    cancelVoice.current = cancel;
    voiceDuration.current = (Date.now() - start.current) / 1000;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  return (
    <section
      className={`page conversation wallpaper-${friend?.wallpaper || "default"}`}
    >
      <header className="conversation-head">
        <IconButton label="Back to chats" onClick={back}>
          <ChevronRight className="rotate" />
        </IconButton>
        <button
          className="conversation-person"
          onClick={() => open({ name: "friend", id })}
        >
          <Avatar spec={user.avatar} />
          <span>
            <b>{user.name.split(" ")[0]}</b>
            <small>
              Fictional friend {friend?.streak ? `· 🔥 ${friend.streak}` : ""}
            </small>
          </span>
        </button>
        <IconButton
          label="Simulated voice call"
          disabled={!allowed}
          onClick={() => open({ name: "call", id })}
        >
          <Phone size={22} />
        </IconButton>
        <IconButton
          label="Simulated video call"
          disabled={!allowed}
          onClick={() => open({ name: "call", id, incoming: false, index: 1 })}
        >
          <Video size={24} />
        </IconButton>
        <IconButton label="Chat settings" onClick={() => setSettings(true)}>
          <MoreHorizontal />
        </IconButton>
      </header>
      <div className="message-scroll" ref={scroll}>
        {messages.length > limit && (
          <button
            className="text-button"
            onClick={() => setLimit((v) => v + 100)}
          >
            Load earlier messages
          </button>
        )}
        <div className="chat-date">
          {new Date(messages[0]?.createdAt || Date.now()).toLocaleDateString(
            undefined,
            { weekday: "long", month: "short", day: "numeric" },
          )}
        </div>
        <p className="thread-local">
          Only you can use this local conversation.
        </p>
        {messages.slice(-limit).map((m, index, array) => {
          const prev = array[index - 1];
          return (
            <div
              key={m.id}
              className={`message ${m.sender === "me" ? "from-me" : "from-friend"}`}
            >
              <div className="message-label">
                {!prev ||
                prev.sender !== m.sender ||
                m.createdAt - prev.createdAt > 300000 ? (
                  <>
                    <b>
                      {m.sender === "me"
                        ? "ME"
                        : user.name.split(" ")[0].toUpperCase()}
                    </b>
                    <time>
                      {new Date(m.createdAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </>
                ) : null}
              </div>
              {m.replyTo && (
                <div className="message-reply">
                  <Reply size={12} />
                  {messages.find((x) => x.id === m.replyTo)?.text ||
                    "Original message removed"}
                </div>
              )}
              <div
                className="message-content"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContext(m);
                }}
                onPointerDown={(e) => {
                  pressPoint.current = { x: e.clientX, y: e.clientY };
                  press.current = setTimeout(() => setContext(m), 500);
                }}
                onPointerMove={(e) => {
                  if (
                    Math.hypot(
                      e.clientX - pressPoint.current.x,
                      e.clientY - pressPoint.current.y,
                    ) > 10 &&
                    press.current
                  )
                    clearTimeout(press.current);
                }}
                onPointerUp={() => {
                  if (press.current) clearTimeout(press.current);
                }}
                onPointerCancel={() => {
                  if (press.current) clearTimeout(press.current);
                }}
              >
                {m.kind === "snap" ? (
                  <button
                    className={`snap-message ${m.expired ? "expired" : ""}`}
                    disabled={m.expired}
                    onClick={() => viewSnap(m)}
                  >
                    <Square
                      size={22}
                      fill={m.expired ? "none" : "currentColor"}
                    />
                    <span>
                      <b>
                        {m.expired
                          ? "Snap opened"
                          : m.sender === "friend"
                            ? "Tap to view Snap"
                            : "View sent Snap"}
                      </b>
                      <small>
                        {m.expired
                          ? "Media no longer accessible"
                          : "Local photo or video"}
                      </small>
                    </span>
                  </button>
                ) : m.kind === "voice" ? (
                  m.mediaId ? (
                    <VoicePlayer id={m.mediaId} />
                  ) : (
                    <span>Recording removed</span>
                  )
                ) : m.kind === "call" ? (
                  <span className="call-message">
                    <Phone size={16} />
                    {m.text}
                  </span>
                ) : (
                  <p>{m.text}</p>
                )}
                <button
                  className="message-more"
                  aria-label={`Message actions: ${m.text.slice(0, 25)}`}
                  onClick={() => setContext(m)}
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
              {m.reaction && (
                <button
                  className="reaction"
                  onClick={() =>
                    void run(() =>
                      db.messages
                        .update(m.id, { reaction: undefined })
                        .then(() => {}),
                    )
                  }
                >
                  {m.reaction}
                </button>
              )}
              {m.sender === "me" && index === array.length - 1 && (
                <div className="message-state">
                  <StatusIcon message={m} />
                  {m.state} · Simulated
                </div>
              )}
            </div>
          );
        })}
        {typing && (
          <div className="typing">
            <Avatar spec={user.avatar} />
            <span>
              <i />
              <i />
              <i />
            </span>
            <small>{user.name.split(" ")[0]} is typing…</small>
          </div>
        )}
      </div>
      {reply && (
        <div className="reply-composer">
          <Reply size={17} />
          <span>
            Replying to{" "}
            {reply.sender === "me" ? "yourself" : user.name.split(" ")[0]}
            <small>{reply.text}</small>
          </span>
          <IconButton label="Cancel reply" onClick={() => setReply(null)}>
            <X size={18} />
          </IconButton>
        </div>
      )}
      {allowed ? (
        <footer className="composer">
          {recording ? (
            <>
              <button
                className="recording-cancel"
                aria-label="Cancel voice message"
                onClick={() => finishVoice(true)}
              >
                <Trash2 size={20} />
              </button>
              <span className="voice-recording">
                <i />
                Recording {Math.floor(elapsed)}s
              </span>
              <button
                className="send-button"
                aria-label="Send voice message"
                onClick={() => finishVoice(false)}
              >
                <Send size={22} />
              </button>
            </>
          ) : (
            <>
              <IconButton
                label="Take a snap"
                onClick={() => {
                  home("camera");
                }}
              >
                <Camera size={24} />
              </IconButton>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <input
                  ref={input}
                  aria-label="Send a Chat"
                  placeholder="Send a Chat"
                  value={text}
                  maxLength={4000}
                  onChange={(e) => setText(e.target.value)}
                />
                {text.trim() ? (
                  <button
                    className="send-button"
                    aria-label="Send message"
                    disabled={sending}
                  >
                    <Send size={20} />
                  </button>
                ) : (
                  <IconButton
                    label="Record voice message"
                    onClick={() => void startVoice()}
                  >
                    <Mic size={20} />
                  </IconButton>
                )}
              </form>
            </>
          )}
        </footer>
      ) : (
        <div className="composer-blocked">
          {friend?.status === "blocked"
            ? "This friend is blocked."
            : "Add this friend to chat."}
        </div>
      )}
      {context && (
        <Sheet title="Message" onClose={() => setContext(null)}>
          <div className="reactions">
            {["❤️", "😂", "🔥", "👍", "😮", "🥰"].map((emoji) => (
              <button
                key={emoji}
                aria-label={`React ${emoji}`}
                onClick={() =>
                  void run(async () => {
                    await db.messages.update(context.id, { reaction: emoji });
                    setContext(null);
                  })
                }
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            className="menu-row"
            onClick={() => {
              setReply(context);
              setContext(null);
              input.current?.focus();
            }}
          >
            <Reply />
            Reply to message
          </button>
          <button
            className="menu-row danger-text"
            onClick={() => setConfirm("delete")}
          >
            <Trash2 />
            Delete message locally
          </button>
        </Sheet>
      )}
      {settings && (
        <Sheet title="Chat settings" onClose={() => setSettings(false)}>
          <button
            className="menu-row"
            onClick={() =>
              void run(() =>
                db.friends
                  .update(friend!.id, { pinned: !friend?.pinned })
                  .then(() => {}),
              )
            }
          >
            <Pin />
            {friend?.pinned ? "Unpin" : "Pin"} conversation
          </button>
          <label className="switch-row">
            Local activity notifications
            <input
              type="checkbox"
              checked={friend?.notifications ?? true}
              onChange={(e) =>
                void run(() =>
                  db.friends
                    .update(friend!.id, { notifications: e.target.checked })
                    .then(() => {}),
                )
              }
            />
          </label>
          <label className="field">
            Chat wallpaper
            <select
              value={friend?.wallpaper}
              onChange={(e) =>
                void run(() =>
                  db.friends
                    .update(friend!.id, { wallpaper: e.target.value })
                    .then(() => {}),
                )
              }
            >
              <option value="default">Plain</option>
              <option value="dots">Little dots</option>
              <option value="sunset">Soft sunset</option>
              <option value="night">Midnight</option>
            </select>
          </label>
          <button
            className="menu-row danger-text"
            onClick={() => setConfirm("clear")}
          >
            <Trash2 />
            Clear conversation
          </button>
          <p className="fine">
            These preferences apply only to the local simulation.
          </p>
        </Sheet>
      )}
      {confirm && (
        <Confirm
          title={confirm === "clear" ? "Clear conversation" : "Delete message"}
          text="This removes the selected local messages and their pending simulation events. Copies in Memories remain available."
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            void run(async () => {
              const ids =
                confirm === "clear" ? messages.map((m) => m.id) : [context!.id];
              await db.transaction("rw", db.messages, db.events, async () => {
                await db.messages.bulkDelete(ids);
                await db.messages
                  .where("accountId")
                  .equals(account.id)
                  .filter((m) => !!m.replyTo && ids.includes(m.replyTo))
                  .modify({ replyTo: undefined });
                await db.events
                  .where("accountId")
                  .equals(account.id)
                  .filter((e) => !!e.messageId && ids.includes(e.messageId))
                  .delete();
              });
              setConfirm(null);
              setContext(null);
              setSettings(false);
            })
          }
        />
      )}
      {snap && (
        <Sheet title="Local Snap" full onClose={() => void closeSnap()}>
          <div className="snap-view">
            <MediaView media={data.media.find((m) => m.id === snap.mediaId)} />
            <p>
              Close to finish viewing ·{" "}
              {account.preferences.retention === "opened"
                ? "Expires after viewing"
                : account.preferences.retention === "24h"
                  ? "Available for 24 hours after viewing"
                  : "Kept until you delete it"}
            </p>
          </div>
        </Sheet>
      )}
    </section>
  );
}
