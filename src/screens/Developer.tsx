import { useState } from "react";
import { useApp } from "../hooks/app";
import { db } from "../data/db";
import { engine } from "../data/engine";
import { id } from "../data/types";
import { sceneSvg } from "../data/seed";
import { Header, Confirm } from "../components/ui";
export function Developer() {
  const { data, run, toast, open } = useApp();
  const [confirm, setConfirm] = useState(false);
  const a = data.account!;
  const friend = data.friends.find((f) => f.status === "friend");
  return (
    <section className="page">
      <Header title="Local test tools" />
      <div className="scroll-content padded">
        <p className="muted">
          Test local simulation without sending data anywhere. This panel shows
          record counts, never private media or PINs.
        </p>
        <dl className="backup-counts">
          {[
            ["Profiles", data.accounts.length],
            ["Fictional users", data.users.length],
            ["Messages", data.messages.length],
            ["Media records", data.media.length],
            ["Stories", data.stories.length],
            ["Pending events", data.events.length],
          ].map(([label, count]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
        <h2>Feature support</h2>
        <ul className="support-list">
          <li>Secure context: {String(isSecureContext)}</li>
          <li>
            Camera & microphone:{" "}
            {String(!!navigator.mediaDevices?.getUserMedia)}
          </li>
          <li>MediaRecorder: {String(!!globalThis.MediaRecorder)}</li>
          <li>Web Crypto: {String(!!crypto.subtle)}</li>
          <li>Service worker: {String("serviceWorker" in navigator)}</li>
          <li>Storage estimates: {String(!!navigator.storage?.estimate)}</li>
          <li>Web Share files: {String(!!navigator.canShare)}</li>
          <li>
            Vibration API: {String("vibrate" in navigator)} (not supported by
            iOS Safari)
          </li>
        </ul>
        <div className="button-stack">
          <button
            className="secondary"
            onClick={() =>
              void run(async () => {
                await engine.activity(
                  a.id,
                  "message",
                  "A fictional notification from the local test panel.",
                  friend?.userId,
                );
                toast("Local notification created.");
              })
            }
          >
            Trigger local notification
          </button>
          <button
            className="secondary"
            disabled={!friend}
            onClick={() =>
              open({
                name: "call",
                id: friend!.userId,
                incoming: true,
                index: 1,
              })
            }
          >
            Trigger fictional incoming video call
          </button>
          <button
            className="secondary"
            disabled={!friend}
            onClick={() =>
              void run(async () => {
                const blob = new Blob([sceneSvg(2)], { type: "image/svg+xml" });
                const media = await engine.saveMedia(
                  a.id,
                  { saved: false, type: "photo", title: "Fictional snap" },
                  { blob, thumbnail: blob },
                );
                await db.messages.add({
                  id: id(),
                  accountId: a.id,
                  userId: friend!.userId,
                  sender: "friend",
                  kind: "snap",
                  text: "New Snap",
                  mediaId: media.id,
                  createdAt: Date.now(),
                  state: "delivered",
                  unread: true,
                });
                await engine.activity(
                  a.id,
                  "snap",
                  "You received a fictional snap.",
                  friend!.userId,
                );
                toast("Fictional snap added to chat.");
              })
            }
          >
            Trigger received snap
          </button>
          <button
            className="secondary"
            onClick={() =>
              void run(async () => {
                await db.events
                  .where("accountId")
                  .equals(a.id)
                  .modify({ due: Date.now() - 1 });
                await engine.tick(a.id);
                toast("Pending local deliveries processed.");
              })
            }
          >
            Process simulated delivery now
          </button>
          <button
            className="secondary"
            onClick={() =>
              void run(async () => {
                await db.stories
                  .where("accountId")
                  .equals(a.id)
                  .modify({ expiresAt: Date.now() - 1 });
                await engine.tick(a.id);
                toast("Story expiration rules processed.");
              })
            }
          >
            Test Story expiration
          </button>
          <button
            className="secondary"
            onClick={() =>
              void run(async () => {
                await db.events.where("accountId").equals(a.id).delete();
                toast("Pending simulation events cleared.");
              })
            }
          >
            Reset pending simulation events
          </button>
          <button className="danger-button" onClick={() => setConfirm(true)}>
            Regenerate fictional demo data
          </button>
        </div>
      </div>
      {confirm && (
        <Confirm
          title="Regenerate demo data"
          text="This resets friendships, messages, Stories, activity, simulation events and counters for this profile. Saved Memories and profile preferences stay available."
          onClose={() => setConfirm(false)}
          onConfirm={() =>
            void run(async () => {
              await db.transaction("rw", db.tables, async () => {
                for (const table of [
                  db.friends,
                  db.messages,
                  db.stories,
                  db.activities,
                  db.events,
                ])
                  await table.where("accountId").equals(a.id).delete();
                await db.accounts.update(a.id, {
                  score: 0,
                  sentTexts: 0,
                  sentSnaps: 0,
                  achievements: [],
                });
                await engine.seed(a.id);
              });
              setConfirm(false);
              toast("Demo conversations regenerated.");
            })
          }
        />
      )}
    </section>
  );
}
