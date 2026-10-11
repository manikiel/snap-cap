import { useState } from "react";
import {
  Images,
  Plus,
  Lock,
  Heart,
  Check,
  Download,
  Send,
  Trash2,
  FolderPlus,
  Unlock,
  Upload,
  Film,
  ChevronRight,
} from "lucide-react";
import { useApp } from "../hooks/app";
import { db } from "../data/db";
import { engine } from "../data/engine";
import { createVault, unlockVault, movePrivate, decrypt } from "../data/crypto";
import { prepareFile, downloadBlob } from "../data/media";
import {
  Header,
  IconButton,
  SearchBox,
  Sheet,
  Confirm,
  Empty,
} from "../components/ui";
import { MediaView } from "../components/MediaView";
export function VaultAccess({ onUnlocked }: { onUnlocked?: () => void }) {
  const { data, run, setVaultKey } = useApp();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [until, setUntil] = useState(0);
  const existing = data.account!.vault;
  async function unlock() {
    if (Date.now() < until) return;
    setBusy(true);
    const result = await run(async () => {
      if (existing) {
        try {
          return await unlockVault(pin, existing);
        } catch (error) {
          const next = attempts + 1;
          setAttempts(next);
          if (next >= 3) setUntil(Date.now() + 30000);
          throw error;
        }
      }
      if (pin !== confirm) throw new Error("Your PINs do not match.");
      const result = await createVault(pin);
      await db.accounts.update(data.account!.id, { vault: result.vault });
      return result.key;
    });
    setPin("");
    setConfirm("");
    if (result) {
      setVaultKey(result);
      onUnlocked?.();
    }
    setBusy(false);
  }
  return (
    <div className="vault-access">
      <div className="vault-lock">
        <Lock size={33} />
      </div>
      <h2>{existing ? "My Eyes Only" : "Keep some moments private."}</h2>
      <p className="muted">
        {existing
          ? "Enter your PIN to decrypt your private Memories."
          : "Private media and thumbnails are encrypted on this device using AES-GCM. Choose a PIN with at least 6 digits. A longer PIN is stronger."}
      </p>
      <label className="field">
        {existing ? "Your PIN" : "Create PIN"}
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      {!existing && (
        <label className="field">
          Confirm PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
          />
        </label>
      )}
      <button
        className="primary"
        disabled={busy || pin.length < 6}
        onClick={unlock}
      >
        {busy ? "Decrypting…" : existing ? "Unlock" : "Set up My Eyes Only"}
      </button>
      {attempts >= 3 && (
        <p className="fine">
          Too many attempts. Wait 30 seconds before trying again.
        </p>
      )}
      <p className="fine">
        There is no PIN recovery. Resetting deletes private media. Your PIN and
        encryption key are never saved. Device malware and a weak PIN remain
        risks; this is not account security.
      </p>
    </div>
  );
}
export function Memories() {
  const { data, open, run, toast, vaultKey, setVaultKey } = useApp();
  const account = data.account!;
  const [tab, setTab] = useState("Snaps");
  const [search, setSearch] = useState("");
  const [album, setAlbum] = useState("All");
  const [selected, setSelected] = useState<string[]>([]);
  const [newCollection, setNewCollection] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [publish, setPublish] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const privateTab = tab === "My Eyes Only";
  const media = data.media
    .filter(
      (m) =>
        m.saved &&
        m.private === privateTab &&
        (tab !== "Favourites" || m.favourite) &&
        (tab !== "Videos" || m.type === "video") &&
        (album === "All" || m.collection === album) &&
        m.title.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  const groups = media.reduce((map, m) => {
    const key = new Date(m.createdAt).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    map.set(key, [...(map.get(key) || []), m]);
    return map;
  }, new Map<string, typeof media>());
  async function importFiles(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    for (const file of [...files])
      await run(async () => {
        const prepared = await prepareFile(file);
        await engine.saveMedia(account.id, prepared.meta, prepared.payload);
      });
    setBusy(false);
    toast("Import finished. Supported files are in Memories.");
  }
  return (
    <section className="page memories">
      <Header title="Memories">
        <IconButton
          label="New collection"
          onClick={() => setNewCollection(true)}
        >
          <FolderPlus />
        </IconButton>
        <label
          className="icon-button file-button"
          aria-label="Import photos or videos"
        >
          <Upload />
          <input
            type="file"
            aria-label="Import photos or videos"
            accept="image/*,video/*"
            multiple
            onChange={(e) => {
              void importFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </Header>
      <div className="filter-chips memory-tabs">
        {["Snaps", "Videos", "Favourites", "My Eyes Only"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => {
              setTab(t);
              setSelected([]);
              setAlbum("All");
            }}
          >
            {t === "My Eyes Only" && <Lock size={13} />} {t}
          </button>
        ))}
      </div>
      {privateTab && !vaultKey ? (
        <div className="scroll-content padded">
          <VaultAccess />
          {account.vault && (
            <button
              className="text-button danger-text"
              onClick={() => setReset(true)}
            >
              Forgot PIN? Reset private Memories
            </button>
          )}
        </div>
      ) : (
        <>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search Memories"
          />
          <div className="memory-toolbar">
            <select
              aria-label="Filter collection"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
            >
              <option>All</option>
              {account.collections.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {privateTab ? (
              <button className="text-button" onClick={() => setVaultKey(null)}>
                <Lock size={16} />
                Lock
              </button>
            ) : (
              <span>
                {media.length} {media.length === 1 ? "memory" : "memories"}
              </span>
            )}
          </div>
          <div className="scroll-content memory-scroll">
            {[...groups.entries()].map(([date, items]) => (
              <section key={date}>
                <h2 className="memory-date">{date}</h2>
                <div className="memory-grid">
                  {items.map((m) => (
                    <div className="memory-cell" key={m.id}>
                      <button
                        aria-label={`Open ${m.title}`}
                        onClick={() => open({ name: "media", id: m.id })}
                      >
                        <MediaView media={m} thumbnail />
                      </button>
                      {!privateTab && (
                        <button
                          className={`memory-select ${selected.includes(m.id) ? "checked" : ""}`}
                          aria-label={`Select ${m.title}`}
                          aria-pressed={selected.includes(m.id)}
                          onClick={() =>
                            setSelected((v) =>
                              v.includes(m.id)
                                ? v.filter((x) => x !== m.id)
                                : [...v, m.id],
                            )
                          }
                        >
                          {selected.includes(m.id) && <Check size={14} />}
                        </button>
                      )}
                      {m.favourite && (
                        <Heart
                          className="favourite-badge"
                          size={15}
                          fill="white"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {!media.length && (
              <Empty
                icon={privateTab ? <Lock /> : <Images />}
                title={
                  search
                    ? "No matching moments"
                    : privateTab
                      ? "Your private space"
                      : "Save your little moments"
                }
              >
                {privateTab
                  ? "Move a Memory here from its details screen."
                  : "Capture a photo, save a video, or import media from Files."}
              </Empty>
            )}
          </div>
          {selected.length > 0 && (
            <footer className="selection-bar">
              <span>{selected.length} selected</span>
              <button className="secondary" onClick={() => setSelected([])}>
                Cancel
              </button>
              <button className="primary" onClick={() => setPublish(true)}>
                Add to Story
              </button>
            </footer>
          )}
          {busy && (
            <div className="import-progress" role="status">
              Importing media…
            </div>
          )}
        </>
      )}
      {newCollection && (
        <Sheet title="New collection" onClose={() => setNewCollection(false)}>
          <label className="field">
            Collection name
            <input
              maxLength={50}
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              autoFocus
            />
          </label>
          <button
            className="primary"
            disabled={!collectionName.trim()}
            onClick={() =>
              void run(async () => {
                const name = collectionName.trim();
                if (account.collections.includes(name))
                  throw new Error(
                    "A collection with this name already exists.",
                  );
                await db.accounts.update(account.id, {
                  collections: [...account.collections, name],
                });
                setCollectionName("");
                setNewCollection(false);
              })
            }
          >
            Create collection
          </button>
        </Sheet>
      )}
      {publish && (
        <PublishStory
          mediaIds={selected}
          onClose={() => setPublish(false)}
          onDone={() => {
            setPublish(false);
            setSelected([]);
            toast("Story published locally for 24 hours.");
          }}
        />
      )}
      {reset && (
        <Confirm
          title="Reset private Memories"
          text="This permanently removes all encrypted private Memories for this profile. Your PIN cannot be recovered. Export a backup first if you might remember it later."
          onClose={() => setReset(false)}
          onConfirm={() =>
            void run(async () => {
              const ids = data.media.filter((m) => m.private).map((m) => m.id);
              await db.transaction(
                "rw",
                db.media,
                db.payloads,
                db.accounts,
                async () => {
                  await db.media.bulkDelete(ids);
                  await db.payloads.bulkDelete(ids);
                  await db.accounts.update(account.id, { vault: undefined });
                },
              );
              setVaultKey(null);
              setReset(false);
            })
          }
        />
      )}
    </section>
  );
}
export function PublishStory({
  mediaIds,
  onClose,
  onDone,
}: {
  mediaIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { data, run } = useApp();
  const [visibility, setVisibility] = useState(
    data.account!.preferences.storyVisibility,
  );
  const [group, setGroup] = useState(data.account!.preferences.storyGroup);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Add to My Story" onClose={onClose}>
      <p className="muted">
        {mediaIds.length} {mediaIds.length === 1 ? "snap" : "snaps"} · Available
        locally for 24 hours
      </p>
      <label className="field">
        Who can view this fictional Story?
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as typeof visibility)}
        >
          <option value="friends">Fictional friends</option>
          <option value="private">Only me</option>
          <option value="custom">Custom friend group</option>
        </select>
      </label>
      {visibility === "custom" &&
        data.friends
          .filter((f) => f.status === "friend")
          .map((f) => (
            <label key={f.id} className="check-row">
              <input
                type="checkbox"
                checked={group.includes(f.userId)}
                onChange={() =>
                  setGroup((v) =>
                    v.includes(f.userId)
                      ? v.filter((x) => x !== f.userId)
                      : [...v, f.userId],
                  )
                }
              />
              {data.users.find((u) => u.id === f.userId)?.name}
            </label>
          ))}
      <button
        className="primary"
        disabled={busy || (visibility === "custom" && !group.length)}
        onClick={async () => {
          setBusy(true);
          const result = await run(() =>
            engine.publishStory(data.account!.id, mediaIds, visibility, group),
          );
          if (result) onDone();
          setBusy(false);
        }}
      >
        Publish locally
      </button>
      <p className="fine">
        Visibility affects only fictional viewers. No media is uploaded.
      </p>
    </Sheet>
  );
}
export function MemoryDetail({ id }: { id: string }) {
  const { data, run, toast, open, back, vaultKey, setVaultKey } = useApp();
  const media = data.media.find((m) => m.id === id);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(media?.title || "");
  const [collection, setCollection] = useState(
    media?.collection || "Camera roll",
  );
  const [confirm, setConfirm] = useState<"delete" | "private" | null>(null);
  const [vault, setVault] = useState(false);
  const [publish, setPublish] = useState(false);
  if (!media)
    return (
      <section className="page">
        <Header title="Memory" />
        <Empty icon={<Images />} title="Memory unavailable">
          It may have been removed.
        </Empty>
      </section>
    );
  const locked = media.private && !vaultKey;
  async function exportMedia() {
    await run(async () => {
      const payload = await db.payloads.get(id);
      if (!payload) throw new Error("Media unavailable.");
      let blob = payload.blob;
      if (media!.private) {
        if (!vaultKey || !payload.iv)
          throw new Error("Unlock My Eyes Only to export this memory.");
        blob = await decrypt(blob, payload.iv, vaultKey, media!.mime);
      }
      await downloadBlob(
        blob,
        `${media!.title.replace(/[^a-z0-9-]/gi, "_")}.${media!.type === "photo" ? "jpg" : media!.mime.includes("mp4") ? "mp4" : "webm"}`,
      );
    });
  }
  return (
    <section className="page memory-detail">
      <Header title={media.private ? "My Eyes Only" : "Memory"}>
        <IconButton
          label={media.favourite ? "Remove favourite" : "Favourite"}
          onClick={() =>
            void run(() =>
              db.media
                .update(id, { favourite: !media.favourite })
                .then(() => {}),
            )
          }
        >
          <Heart fill={media.favourite ? "currentColor" : "none"} />
        </IconButton>
        <IconButton
          label="Export memory"
          disabled={locked}
          onClick={() => void exportMedia()}
        >
          <Download />
        </IconButton>
      </Header>
      <div className="detail-media">
        <MediaView media={media} />
      </div>
      <div className="detail-info">
        <b>{media.title}</b>
        <small>
          {new Date(media.createdAt).toLocaleString()} ·{" "}
          {(media.size / 1024 / 1024).toFixed(1)} MB
        </small>
      </div>
      <div className="detail-actions">
        {locked ? (
          <button className="primary" onClick={() => setVault(true)}>
            <Lock size={18} />
            Unlock
          </button>
        ) : (
          <>
            <button className="secondary" onClick={() => setEdit(true)}>
              Details
            </button>
            <button
              className="secondary"
              onClick={() => {
                if (!vaultKey) setVault(true);
                else setConfirm("private");
              }}
            >
              {media.private ? <Unlock size={18} /> : <Lock size={18} />}
            </button>
            {!media.private && (
              <button
                className="primary"
                onClick={() => open({ name: "send", id })}
              >
                Send <Send size={17} />
              </button>
            )}
          </>
        )}
        <IconButton label="Delete memory" onClick={() => setConfirm("delete")}>
          <Trash2 />
        </IconButton>
      </div>
      {!media.private && (
        <button className="text-button" onClick={() => setPublish(true)}>
          Add to My Story
        </button>
      )}
      {edit && (
        <Sheet title="Memory details" onClose={() => setEdit(false)}>
          {!media.private && (
            <label className="field">
              Title
              <input
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
          )}
          <label className="field">
            Collection
            <select
              value={collection}
              disabled={media.private}
              onChange={(e) => setCollection(e.target.value)}
            >
              {data.account!.collections.map((c) => (
                <option key={c}>{c}</option>
              ))}
              {media.private && <option>My Eyes Only</option>}
            </select>
          </label>
          <button
            className="primary"
            onClick={() =>
              void run(async () => {
                await db.media.update(id, {
                  title: media.private ? "Private memory" : title,
                  collection,
                });
                setEdit(false);
              })
            }
          >
            Save details
          </button>
        </Sheet>
      )}
      {vault && (
        <Sheet title="My Eyes Only" onClose={() => setVault(false)}>
          <VaultAccess
            onUnlocked={() => {
              setVault(false);
              if (!media.private) setConfirm("private");
            }}
          />
        </Sheet>
      )}
      {confirm && (
        <Confirm
          title={
            confirm === "delete"
              ? "Delete memory"
              : media.private
                ? "Move out of My Eyes Only"
                : "Move to My Eyes Only"
          }
          danger={confirm === "delete"}
          text={
            confirm === "delete"
              ? "This removes the local file and access from Stories and message records using it. Previously exported copies are unaffected."
              : media.private
                ? "This decrypts the memory and places it in your public local gallery."
                : "This encrypts the Memory and thumbnail. Copies already sent to fictional chats or exported remain outside this private section."
          }
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            void run(async () => {
              if (confirm === "delete") {
                await engine.deleteMedia(data.account!.id, id);
                back();
              } else {
                if (!vaultKey)
                  throw new Error("Unlock your private section first.");
                await movePrivate(
                  data.account!.id,
                  id,
                  vaultKey,
                  !media.private,
                );
                toast(
                  media.private
                    ? "Moved to Memories"
                    : "Encrypted and moved to My Eyes Only",
                );
              }
              setConfirm(null);
            })
          }
        />
      )}{" "}
      {publish && (
        <PublishStory
          mediaIds={[id]}
          onClose={() => setPublish(false)}
          onDone={() => {
            setPublish(false);
            toast("Story published locally.");
          }}
        />
      )}
    </section>
  );
}
