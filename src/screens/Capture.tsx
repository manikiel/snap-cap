import { useState } from "react";
import { X, Download, Send, RotateCcw, Check, Users } from "lucide-react";
import { useApp } from "../hooks/app";
import { engine } from "../data/engine";
import { IconButton, Header, SearchBox } from "../components/ui";
import { MediaView } from "../components/MediaView";
import { Avatar } from "../components/Avatar";
export function CapturePreview({ id }: { id: string }) {
  const { data, back, home, open, run, toast } = useApp();
  const media = data.media.find((m) => m.id === id);
  return (
    <section className="snap-preview">
      <MediaView media={media} />
      <div className="preview-top">
        <IconButton label="Close snap" onClick={back}>
          <X />
        </IconButton>
      </div>
      <div className="preview-bottom">
        <button className="preview-action" onClick={() => home("camera")}>
          <RotateCcw />
          Retake
        </button>
        <button
          className="preview-action"
          onClick={() =>
            void run(async () => {
              await engine.remember(data.account!.id, id);
              toast("Saved to Memories");
            })
          }
        >
          <Download />
          {media?.saved ? "Saved" : "Save"}
        </button>
        <button
          className="yellow-pill"
          onClick={() => open({ name: "send", id })}
        >
          Send To <Send size={19} />
        </button>
      </div>
    </section>
  );
}
export function SendTo({ id }: { id: string }) {
  const { data, run, home, toast, open } = useApp();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [story, setStory] = useState(false);
  const [busy, setBusy] = useState(false);
  const friends = data.users.filter(
    (u) =>
      data.friends.some((f) => f.userId === u.id && f.status === "friend") &&
      `${u.name} ${u.username}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function send() {
    setBusy(true);
    const result = await run(async () => {
      if (selected.length)
        await engine.sendSnap(data.account!.id, selected, id);
      if (story)
        await engine.publishStory(
          data.account!.id,
          [id],
          data.account!.preferences.storyVisibility,
          data.account!.preferences.storyGroup,
        );
      return true;
    });
    if (result) {
      home("chat");
      toast(
        story && selected.length
          ? "Snap sent and Story published locally."
          : story
            ? "Story published to the local simulation."
            : "Snap sent to fictional friends.",
      );
      if (selected.length === 1)
        open({ name: "conversation", id: selected[0] });
    }
    setBusy(false);
  }
  return (
    <section className="page send-page">
      <Header title="Send To" />
      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search friends"
      />
      <div className="section-label">STORIES</div>
      <button
        className={`recipient ${story ? "selected" : ""}`}
        onClick={() => setStory((v) => !v)}
      >
        <div className="story-plus">
          <Users />
        </div>
        <span>
          <b>My Story</b>
          <small>
            {data.account?.preferences.storyVisibility === "private"
              ? "Only me"
              : data.account?.preferences.storyVisibility === "custom"
                ? "Custom fictional friends"
                : "My fictional friends"}
          </small>
        </span>
        <i>{story && <Check size={18} />}</i>
      </button>
      <div className="section-label">FRIENDS</div>
      <div className="scroll-content">
        {friends.map((u) => (
          <button
            key={u.id}
            className={`recipient ${selected.includes(u.id) ? "selected" : ""}`}
            onClick={() =>
              setSelected((v) =>
                v.includes(u.id) ? v.filter((x) => x !== u.id) : [...v, u.id],
              )
            }
          >
            <Avatar spec={u.avatar} />
            <span>
              <b>{u.name}</b>
              <small>{u.username}</small>
            </span>
            <i>{selected.includes(u.id) && <Check size={18} />}</i>
          </button>
        ))}
        {!friends.length && (
          <p className="muted padded">
            Add a fictional friend from your profile first.
          </p>
        )}
      </div>
      <footer className="send-footer">
        <p>Local simulation · Nothing leaves your device</p>
        <button
          className="primary"
          disabled={busy || (!selected.length && !story)}
          onClick={send}
        >
          {busy
            ? "Sending…"
            : `Send${selected.length ? ` (${selected.length})` : ""}`}
          <Send size={18} />
        </button>
      </footer>
    </section>
  );
}
