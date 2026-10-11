import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Download,
  Upload,
  Trash2,
  HardDrive,
  ShieldCheck,
  RefreshCw,
  Users,
  Info,
} from "lucide-react";
import { useApp } from "../hooks/app";
import { db } from "../data/db";
import { engine } from "../data/engine";
import { accountKey } from "../data/db";
import {
  exportBackup,
  readBackup,
  restoreBackup,
  type Backup,
} from "../data/backup";
import { downloadBlob } from "../data/media";
import { Header, Sheet, Confirm } from "../components/ui";
export function SettingsScreen() {
  const {
    data,
    open,
    run,
    toast,
    home,
    newAccount,
    setVaultKey,
    switchAccount,
  } = useApp();
  const a = data.account!;
  const p = a.preferences;
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(a.name);
  const [username, setUsername] = useState(a.username);
  const [bio, setBio] = useState(a.bio);
  const [birthday, setBirthday] = useState(a.birthday);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [confirm, setConfirm] = useState<"reset" | "cache" | null>(null);
  const [usage, setUsage] = useState<StorageEstimate | null>(null);
  const [busy, setBusy] = useState("");
  const taps = useRef(0);
  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then(setUsage)
      .catch(() => {});
  }, [data.media.length]);
  const preferences = (
    values: Parameters<typeof engine.updatePreferences>[1],
  ) => void run(() => engine.updatePreferences(a.id, values));
  async function exportData() {
    setBusy("Preparing backup…");
    await run(async () => {
      const blob = await exportBackup();
      await downloadBlob(
        blob,
        `snapchat-local-backup-${new Date().toISOString().slice(0, 10)}.json`,
      );
      toast("Backup ready. On iPhone, choose Save to Files for iCloud Drive.");
    });
    setBusy("");
  }
  async function importData(file?: File) {
    if (!file) return;
    setBusy("Validating backup…");
    const result = await run(() => readBackup(file));
    if (result) setBackup(result);
    setBusy("");
  }
  return (
    <section className="page settings">
      <Header title="Settings" />
      <div className="scroll-content">
        <h2 className="settings-heading">MY ACCOUNT</h2>
        <button className="setting-row" onClick={() => setEdit(true)}>
          <span>Name</span>
          <b>{a.name}</b>
          <ChevronRight size={16} />
        </button>
        <button className="setting-row" onClick={() => setEdit(true)}>
          <span>Username</span>
          <b>{a.username}</b>
          <ChevronRight size={16} />
        </button>
        <button className="setting-row" onClick={() => setEdit(true)}>
          <span>Birthday</span>
          <b>{a.birthday || "Not set"}</b>
          <ChevronRight size={16} />
        </button>
        <button
          className="setting-row"
          onClick={() => open({ name: "avatar" })}
        >
          <span>My Avatar</span>
          <ChevronRight size={16} />
        </button>
        <button
          className="setting-row"
          onClick={() => open({ name: "profile" })}
        >
          <span>Switch local profile</span>
          <ChevronRight size={16} />
        </button>
        <h2 className="settings-heading">APPEARANCE</h2>
        <label className="setting-row">
          <span>App theme</span>
          <select
            aria-label="App theme"
            value={p.theme}
            onChange={(e) =>
              preferences({ theme: e.target.value as typeof p.theme })
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="setting-row">
          <span>Text size</span>
          <select
            aria-label="Text size"
            value={p.textSize}
            onChange={(e) => preferences({ textSize: +e.target.value })}
          >
            <option value="1">Standard</option>
            <option value="1.15">Larger</option>
            <option value="1.3">Large</option>
            <option value="1.5">Extra large</option>
          </select>
        </label>
        <label className="switch-row setting-row">
          Reduce motion
          <input
            type="checkbox"
            checked={p.reducedMotion}
            onChange={(e) => preferences({ reducedMotion: e.target.checked })}
          />
        </label>
        <h2 className="settings-heading">LOCAL SIMULATION</h2>
        <label className="switch-row setting-row">
          Fictional replies & activity
          <input
            type="checkbox"
            checked={p.simulation}
            onChange={(e) => preferences({ simulation: e.target.checked })}
          />
        </label>
        <label className="switch-row setting-row">
          In-app activity notifications
          <input
            type="checkbox"
            checked={p.notifications}
            onChange={(e) => preferences({ notifications: e.target.checked })}
          />
        </label>
        <label className="setting-row">
          <span>Chat retention</span>
          <select
            aria-label="Chat retention"
            value={p.retention}
            onChange={(e) =>
              preferences({ retention: e.target.value as typeof p.retention })
            }
          >
            <option value="opened">Snaps after viewing</option>
            <option value="24h">24 hours after opening</option>
            <option value="forever">Keep until deleted</option>
          </select>
        </label>
        <p className="setting-note">
          Sent, delivered and opened states, replies, streaks, calls and views
          are simulated. Expiration removes local access; it does not guarantee
          irreversible erasure. No remote push notifications.
        </p>
        <h2 className="settings-heading">PRIVACY CONTROLS</h2>
        <label className="setting-row">
          <span>Friend list visibility</span>
          <select
            aria-label="Friend list visibility"
            value={p.friendVisibility}
            onChange={(e) =>
              preferences({
                friendVisibility: e.target.value as typeof p.friendVisibility,
              })
            }
          >
            <option value="friends">Fictional friends</option>
            <option value="private">Only me</option>
          </select>
        </label>
        <label className="setting-row">
          <span>Default Story visibility</span>
          <select
            aria-label="Default Story visibility"
            value={p.storyVisibility}
            onChange={(e) =>
              preferences({
                storyVisibility: e.target.value as typeof p.storyVisibility,
              })
            }
          >
            <option value="friends">Fictional friends</option>
            <option value="private">Only me</option>
            <option value="custom">Custom group</option>
          </select>
        </label>
        {p.storyVisibility === "custom" &&
          data.friends
            .filter((f) => f.status === "friend")
            .map((f) => (
              <label className="check-row padded" key={f.id}>
                <input
                  type="checkbox"
                  checked={p.storyGroup.includes(f.userId)}
                  onChange={() =>
                    preferences({
                      storyGroup: p.storyGroup.includes(f.userId)
                        ? p.storyGroup.filter((x) => x !== f.userId)
                        : [...p.storyGroup, f.userId],
                    })
                  }
                />
                {data.users.find((u) => u.id === f.userId)?.name}
              </label>
            ))}
        <h3 className="padded">Blocked friends</h3>
        {data.friends
          .filter((f) => f.status === "blocked")
          .map((f) => (
            <button
              key={f.id}
              className="setting-row"
              onClick={() => open({ name: "friend", id: f.userId })}
            >
              <span>{data.users.find((u) => u.id === f.userId)?.name}</span>
              <ChevronRight size={16} />
            </button>
          ))}
        {!data.friends.some((f) => f.status === "blocked") && (
          <p className="setting-note">No blocked fictional friends.</p>
        )}
        <p className="setting-note">
          These controls change local simulation behaviour. Your records are not
          shared on a network. Local profiles are not password-protected
          accounts.
        </p>
        <h2 className="settings-heading">STORAGE & BACKUPS</h2>
        <div className="storage-summary">
          <HardDrive />
          <div>
            <b>
              {(
                data.media.reduce((n, m) => n + m.size, 0) /
                1024 /
                1024
              ).toFixed(1)}{" "}
              MB of media
            </b>
            <small>
              {usage?.usage
                ? `${(usage.usage / 1024 / 1024).toFixed(1)} MB total website storage`
                : "Website storage estimate unavailable"}
            </small>
            {usage?.quota && (
              <small>
                {(usage.quota / 1024 / 1024).toFixed(0)} MB estimated quota
              </small>
            )}
          </div>
        </div>
        <button
          className="setting-row"
          onClick={() =>
            void run(async () => {
              const persistent = await navigator.storage?.persist?.();
              toast(
                persistent
                  ? "Persistent storage granted. Backups are still recommended."
                  : "Persistent storage was not granted by this browser. Keep backups in Files.",
              );
            })
          }
        >
          <span>Request persistent storage</span>
          <ShieldCheck size={18} />
        </button>
        <button
          className="setting-row"
          disabled={!!busy}
          onClick={() => void exportData()}
        >
          <span>Export complete JSON backup</span>
          <Download size={18} />
        </button>
        <label className="setting-row file-button">
          <span>Import backup</span>
          <Upload size={18} />
          <input
            type="file"
            aria-label="Import backup"
            accept="application/json,.json"
            onChange={(e) => {
              void importData(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button className="setting-row" onClick={() => setConfirm("cache")}>
          <span>Clear app cache</span>
          <RefreshCw size={18} />
        </button>
        <button
          className="setting-row danger-text"
          onClick={() => setConfirm("reset")}
        >
          <span>Delete this local profile</span>
          <Trash2 size={18} />
        </button>
        <p className="setting-note">
          Safari may evict website data. Clearing site data or removing the app
          can erase records. Save JSON backups to Files; choose iCloud Drive
          manually if available. There is no automatic iCloud sync. JSON backups
          include all local profiles, metadata and media up to 32 MB; larger
          videos can be exported individually.
        </p>
        <h2 className="settings-heading">ABOUT</h2>
        <div className="local-card">
          <b>Snapchat · Unofficial local recreation</b>
          <p>
            Not affiliated with Snap Inc. No real authentication, messaging,
            calls or Snapchat service connections. Camera, microphone and Files
            access are requested only for actions you choose.
          </p>
          <p>
            iPhone: open this page in Safari, tap Share, then Add to Home
            Screen. Camera permissions, codecs, flash, zoom and storage support
            depend on your browser. Safari on iOS does not provide web vibration
            haptics.
          </p>
          <button
            className="text-button"
            onClick={() => {
              if (++taps.current >= 7) {
                taps.current = 0;
                open({ name: "dev" });
              }
            }}
          >
            Local edition · 1.0.0
          </button>
        </div>
        {busy && (
          <p className="setting-note" role="status">
            {busy}
          </p>
        )}
      </div>
      {edit && (
        <Sheet title="Edit local profile" onClose={() => setEdit(false)}>
          <label className="field">
            Display name
            <input
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            Username
            <input
              value={username}
              maxLength={24}
              autoCapitalize="none"
              onChange={(e) =>
                setUsername(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ""))
              }
            />
          </label>
          <label className="field">
            About me
            <textarea
              value={bio}
              maxLength={300}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          <label className="field">
            Birthday
            <input
              type="date"
              value={birthday}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={!name.trim() || username.length < 3}
            onClick={() =>
              void run(async () => {
                await db.accounts.update(a.id, {
                  name: name.trim(),
                  username,
                  bio,
                  birthday,
                });
                setEdit(false);
              })
            }
          >
            Save profile
          </button>
        </Sheet>
      )}
      {backup && (
        <Sheet title="Restore backup" onClose={() => setBackup(null)}>
          <p className="muted">
            Backup from {new Date(backup.createdAt).toLocaleString()}
          </p>
          <dl className="backup-counts">
            <dt>Local profiles</dt>
            <dd>{backup.records.accounts.length}</dd>
            <dt>Messages</dt>
            <dd>{backup.records.messages.length}</dd>
            <dt>Memories & attachments</dt>
            <dd>{backup.records.media.length}</dd>
            <dt>Stories</dt>
            <dd>{backup.records.stories.length}</dd>
          </dl>
          <p>
            Restore creates separate profiles labelled “restored”. Existing
            profiles and records are preserved. Private media remains encrypted
            and needs its original PIN.
          </p>
          <button
            className="primary"
            disabled={!!busy}
            onClick={async () => {
              setBusy("Restoring backup…");
              const id = await run(() => restoreBackup(backup));
              if (id) {
                setBackup(null);
                switchAccount(id);
                toast("Backup restored as separate local profiles.");
              }
              setBusy("");
            }}
          >
            Restore as new local profiles
          </button>
        </Sheet>
      )}
      {confirm && (
        <Confirm
          title={
            confirm === "cache" ? "Clear app cache" : "Delete local profile"
          }
          text={
            confirm === "cache"
              ? "This removes cached app files only. Media and histories remain. You will need a connection to recache the app before using it offline."
              : "This deletes this profile and its messages, media, Stories, activity and preferences. Other local profiles remain. Export a backup first."
          }
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            void run(async () => {
              if (confirm === "cache") {
                for (const key of await caches.keys())
                  if (key.startsWith("snap-cap-shell-"))
                    await caches.delete(key);
                toast(
                  "Cache cleared. Reopen online to restore offline support.",
                );
                setConfirm(null);
              } else {
                await db.transaction("rw", db.tables, async () => {
                  const mediaIds = (
                    await db.media.where("accountId").equals(a.id).toArray()
                  ).map((m) => m.id);
                  await db.payloads.bulkDelete(mediaIds);
                  for (const table of [
                    db.friends,
                    db.messages,
                    db.media,
                    db.stories,
                    db.activities,
                    db.events,
                  ])
                    await table.where("accountId").equals(a.id).delete();
                  await db.accounts.delete(a.id);
                });
                setVaultKey(null);
                localStorage.removeItem(accountKey);
                const next = data.accounts.find((x) => x.id !== a.id);
                if (next) switchAccount(next.id);
                else newAccount();
              }
            })
          }
        />
      )}
    </section>
  );
}
