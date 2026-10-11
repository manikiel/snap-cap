import { useEffect, useRef, useState } from "react";
import {
  Plus,
  MoreHorizontal,
  Eye,
  X,
  Send,
  Images,
  Trash2,
  Users,
  Pause,
  Play,
} from "lucide-react";
import { useApp } from "../hooks/app";
import { db } from "../data/db";
import { engine } from "../data/engine";
import { Avatar } from "../components/Avatar";
import { MediaView } from "../components/MediaView";
import {
  Header,
  IconButton,
  Empty,
  Sheet,
  Confirm,
  timeAgo,
} from "../components/ui";
import type { Story } from "../data/types";
export function StoriesFeed() {
  const { data, open, run } = useApp();
  const [manage, setManage] = useState<Story | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const stories = data.stories
    .filter(
      (s) =>
        !s.expired &&
        s.items.length &&
        s.expiresAt > Date.now() &&
        (s.userId === "me" ||
          data.friends.some(
            (f) => f.userId === s.userId && f.status === "friend",
          )),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  const friends = stories.filter((s) => s.userId !== "me");
  const mine = stories.filter((s) => s.userId === "me");
  return (
    <section className="page stories">
      <Header title="Stories" back={false}>
        <IconButton
          label="Add fictional friends"
          onClick={() => open({ name: "friends" })}
        >
          <Users />
        </IconButton>
        <IconButton
          label="My Memories"
          onClick={() => open({ name: "memories" })}
        >
          <Images />
        </IconButton>
      </Header>
      <div className="scroll-content">
        <section className="my-story-section">
          <h2>My Stories</h2>
          <div className="my-story-row">
            <button
              className="story-avatar create-story"
              onClick={() => open({ name: "memories" })}
            >
              <Avatar spec={data.account!.avatar} />
              <span className="story-add">
                <Plus size={16} />
              </span>
            </button>
            <button
              className="my-story-text"
              onClick={() =>
                mine[0]
                  ? open({ name: "story", id: mine[0].id })
                  : open({ name: "memories" })
              }
            >
              <b>My Story</b>
              <small>
                {mine.length
                  ? `${mine.reduce((n, s) => n + s.items.length, 0)} snaps · ${mine.reduce((n, s) => n + s.viewers.length, 0)} simulated views`
                  : "Add a moment from Memories"}
              </small>
            </button>
            <IconButton
              label="Create Story"
              onClick={() => open({ name: "memories" })}
            >
              <Plus />
            </IconButton>
          </div>
          {mine.map((s) => (
            <div key={s.id} className="own-story">
              <button onClick={() => open({ name: "story", id: s.id })}>
                <div className="story-thumb">
                  <MediaView
                    media={data.media.find((m) => m.id === s.items[0])}
                    thumbnail
                  />
                </div>
                <span>
                  <b>
                    {s.visibility === "private"
                      ? "Private Story"
                      : s.visibility === "custom"
                        ? "Custom Story"
                        : "My Story"}
                  </b>
                  <small>
                    {s.items.length} snaps · {timeAgo(s.createdAt)} ·{" "}
                    <Eye size={12} />
                    {s.viewers.length}
                  </small>
                </span>
              </button>
              <IconButton label="Manage Story" onClick={() => setManage(s)}>
                <MoreHorizontal />
              </IconButton>
            </div>
          ))}
        </section>
        <section className="friends-story-section">
          <h2>Friends</h2>
          <div className="story-carousel">
            {friends.map((s) => {
              const user = data.users.find((u) => u.id === s.userId)!;
              return (
                <button
                  className="friend-story"
                  key={s.id}
                  onClick={() => open({ name: "story", id: s.id })}
                >
                  <div
                    className={`story-avatar ${s.items.every((i) => s.viewedItems.includes(i)) ? "viewed" : ""}`}
                  >
                    <Avatar spec={user.avatar} />
                  </div>
                  <b>{user.name.split(" ")[0]}</b>
                </button>
              );
            })}
          </div>
          <div className="friend-story-grid">
            {friends.map((s) => {
              const user = data.users.find((u) => u.id === s.userId)!;
              return (
                <button
                  key={s.id}
                  className="story-card"
                  onClick={() => open({ name: "story", id: s.id })}
                >
                  <MediaView
                    media={data.media.find((m) => m.id === s.items[0])}
                    thumbnail
                  />
                  <div>
                    <Avatar spec={user.avatar} />
                    <span>
                      <b>{user.name.split(" ")[0]}</b>
                      <small>{timeAgo(s.createdAt)}</small>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {!friends.length && (
            <Empty icon={<Users />} title="A little quiet here">
              Your fictional friends’ active Stories will appear here.
            </Empty>
          )}
        </section>
        <p className="inbox-note">
          Stories and views are simulated locally. Nothing is published online.
        </p>
      </div>
      {manage && (
        <Sheet title="Manage Story" onClose={() => setManage(null)}>
          <p className="muted">
            Expires {new Date(manage.expiresAt).toLocaleString()}
          </p>
          <label className="field">
            Visibility
            <select
              value={data.stories.find((s) => s.id === manage.id)?.visibility}
              onChange={(e) =>
                void run(() =>
                  db.stories
                    .update(manage.id, {
                      visibility: e.target.value as Story["visibility"],
                    })
                    .then(() => {}),
                )
              }
            >
              <option value="friends">Fictional friends</option>
              <option value="private">Only me</option>
              <option value="custom">Custom group</option>
            </select>
          </label>
          {data.stories.find((s) => s.id === manage.id)?.visibility ===
            "custom" &&
            data.friends
              .filter((f) => f.status === "friend")
              .map((f) => (
                <label className="check-row" key={f.id}>
                  <input
                    type="checkbox"
                    checked={data.stories
                      .find((s) => s.id === manage.id)!
                      .group.includes(f.userId)}
                    onChange={() =>
                      void run(async () => {
                        const current = await db.stories.get(manage.id);
                        if (current)
                          await db.stories.update(current.id, {
                            group: current.group.includes(f.userId)
                              ? current.group.filter((x) => x !== f.userId)
                              : [...current.group, f.userId],
                          });
                      })
                    }
                  />
                  {data.users.find((u) => u.id === f.userId)?.name}
                </label>
              ))}
          <h3>Fictional viewers</h3>
          <p className="muted">
            {manage.viewers
              .map((id) => data.users.find((u) => u.id === id)?.name)
              .join(", ") || "No simulated views yet."}
          </p>
          <h3>Snaps</h3>
          {manage.items.map((item, index) => (
            <button
              className="menu-row danger-text"
              key={item}
              onClick={() => setConfirm(item)}
            >
              <Trash2 />
              Delete snap {index + 1}
            </button>
          ))}
          <button className="danger-button" onClick={() => setConfirm("story")}>
            Delete Story
          </button>
        </Sheet>
      )}
      {confirm && manage && (
        <Confirm
          title={confirm === "story" ? "Delete Story" : "Delete Story snap"}
          text="This removes the local Story item. Your original Memory remains available."
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            void run(async () => {
              if (confirm === "story") {
                await db.stories.delete(manage.id);
                await db.events
                  .where("accountId")
                  .equals(data.account!.id)
                  .filter((e) => e.storyId === manage.id)
                  .delete();
                setManage(null);
              } else {
                const items = manage.items.filter((i) => i !== confirm);
                await db.stories.update(manage.id, { items });
                setManage({ ...manage, items });
              }
              setConfirm(null);
            })
          }
        />
      )}
    </section>
  );
}
export function StoryViewer({ id }: { id: string }) {
  const { data, back, run, toast } = useApp();
  const [storyId, setStoryId] = useState(id);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const start = useRef({ x: 0, y: 0, time: 0 });
  const stories = data.stories
    .filter(
      (s) =>
        !s.expired &&
        s.items.length &&
        s.expiresAt > Date.now() &&
        (s.userId === "me" ||
          data.friends.some(
            (f) => f.userId === s.userId && f.status === "friend",
          )),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  const story = stories.find((s) => s.id === storyId);
  const media = data.media.find((m) => m.id === story?.items[index]);
  const user =
    story?.userId === "me"
      ? data.account
      : data.users.find((u) => u.id === story?.userId);
  const advance = () => {
    if (!story) {
      back();
      return;
    }
    if (index < story.items.length - 1) {
      setIndex((i) => i + 1);
      setProgress(0);
    } else {
      const next = stories[stories.findIndex((s) => s.id === storyId) + 1];
      if (next) {
        setStoryId(next.id);
        setIndex(0);
        setProgress(0);
      } else back();
    }
  };
  const previous = () => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setProgress(0);
    } else {
      const prev = stories[stories.findIndex((s) => s.id === storyId) - 1];
      if (prev) {
        setStoryId(prev.id);
        setIndex(prev.items.length - 1);
        setProgress(0);
      } else setProgress(0);
    }
  };
  useEffect(() => {
    setProgress(0);
    if (story && media && !story.viewedItems.includes(media.id))
      void run(() =>
        db.stories
          .update(story.id, { viewedItems: [...story.viewedItems, media.id] })
          .then(() => {}),
      );
  }, [storyId, index, media?.id]);
  useEffect(() => {
    if (paused || focused || !story) return;
    const duration =
      media?.type === "video" ? (media.duration || 12) * 1000 : 6500;
    const timer = setInterval(
      () => setProgress((p) => Math.min(1, p + 50 / duration)),
      50,
    );
    return () => clearInterval(timer);
  }, [paused, focused, storyId, index, media?.duration]);
  useEffect(() => {
    if (progress >= 1) advance();
  }, [progress]);
  if (!story || !media)
    return (
      <section className="story-viewer">
        <IconButton label="Close Story" onClick={back}>
          <X />
        </IconButton>
        <Empty icon={<Images />} title="Story expired">
          This local Story is no longer available.
        </Empty>
      </section>
    );
  return (
    <section
      className="story-viewer"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button,input,form")) return;
        start.current = { x: e.clientX, y: e.clientY, time: Date.now() };
        setPaused(true);
      }}
      onPointerUp={(e) => {
        if ((e.target as HTMLElement).closest("button,input,form")) return;
        setPaused(false);
        const dx = e.clientX - start.current.x,
          dy = e.clientY - start.current.y;
        if (dy > 80 && dy > Math.abs(dx) * 1.5) {
          back();
          return;
        }
        if (
          Date.now() - start.current.time < 300 &&
          Math.abs(dx) < 35 &&
          Math.abs(dy) < 35
        )
          e.clientX < innerWidth * 0.33 ? previous() : advance();
      }}
      onPointerCancel={() => setPaused(false)}
    >
      <div className="story-image">
        <MediaView
          key={media.id}
          media={media}
          autoPlay
          paused={paused || focused}
          onEnded={advance}
        />
      </div>
      <header className="story-viewer-header">
        <div className="story-progress">
          {story.items.map((m, i) => (
            <span key={m}>
              <i
                style={{
                  transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})`,
                }}
              />
            </span>
          ))}
        </div>
        <div className="story-person">
          <Avatar spec={user?.avatar} />
          <span>
            <b>{user?.name}</b>
            <small>{timeAgo(story.createdAt)} · Local Story</small>
          </span>
          <IconButton
            label={paused ? "Play Story" : "Pause Story"}
            onClick={() => setPaused((v) => !v)}
          >
            {paused ? <Play size={19} /> : <Pause size={19} />}
          </IconButton>
          <IconButton label="Close Story" onClick={back}>
            <X />
          </IconButton>
        </div>
      </header>
      <div className="story-accessible">
        <button aria-label="Previous Story snap" onClick={previous} />
        <button aria-label="Next Story snap" onClick={advance} />
      </div>
      {story.userId === "me" ? (
        <footer className="story-footer">
          <Eye size={18} />
          {story.viewers.length} fictional viewers ·{" "}
          {story.visibility === "private"
            ? "Only me"
            : story.visibility === "custom"
              ? "Custom friends"
              : "Fictional friends"}
        </footer>
      ) : (
        <form
          className="story-reply"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!text.trim()) return;
              await engine.send(
                data.account!.id,
                story.userId,
                "text",
                `Replied to your Story: ${text}`,
              );
              setText("");
              toast("Story reply sent locally.");
            });
          }}
        >
          <input
            aria-label="Reply to Story"
            placeholder="Send a Chat"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <button aria-label="Send Story reply" disabled={!text.trim()}>
            <Send size={21} />
          </button>
        </form>
      )}
    </section>
  );
}
