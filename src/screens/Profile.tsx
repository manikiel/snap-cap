import { useState } from "react";
import {
  Settings,
  Users,
  Images,
  ChevronRight,
  Edit3,
  Trophy,
  Bell,
  Plus,
  UserRound,
} from "lucide-react";
import { useApp } from "../hooks/app";
import { db } from "../data/db";
import { Avatar } from "../components/Avatar";
import { AvatarEditor } from "../components/AvatarEditor";
import { Header, IconButton, Sheet } from "../components/ui";
export function Profile() {
  const { data, open, switchAccount, newAccount } = useApp();
  const account = data.account!;
  const [switcher, setSwitcher] = useState(false);
  return (
    <section className="page profile">
      <Header title="My Profile">
        <IconButton label="Settings" onClick={() => open({ name: "settings" })}>
          <Settings />
        </IconButton>
      </Header>
      <div className="scroll-content">
        <div className="profile-hero">
          <button
            aria-label="Edit avatar"
            onClick={() => open({ name: "avatar" })}
          >
            <Avatar spec={account.avatar} />
            <span>
              <Edit3 size={17} />
            </span>
          </button>
          <h1>{account.name}</h1>
          <p>{account.username}</p>
          <div className="snapscore">
            <b>{account.score}</b>
            <span>Snapscore · Local</span>
          </div>
        </div>
        <div className="profile-body">
          <p className="profile-bio">
            {account.bio || "A little space for your little moments."}
          </p>
          <button
            className="menu-row"
            onClick={() => open({ name: "friends" })}
          >
            <Users />
            <span>
              My Friends
              <small>
                {data.friends.filter((f) => f.status === "friend").length}{" "}
                fictional friends
              </small>
            </span>
            <ChevronRight />
          </button>
          <button
            className="menu-row"
            onClick={() => open({ name: "memories" })}
          >
            <Images />
            <span>
              Memories
              <small>
                {data.media.filter((m) => m.saved).length} moments on this
                device
              </small>
            </span>
            <ChevronRight />
          </button>
          <button
            className="menu-row"
            onClick={() => open({ name: "notifications" })}
          >
            <Bell />
            <span>
              Activity
              <small>
                {data.activities.filter((a) => !a.read).length} unread local
                notifications
              </small>
            </span>
            <ChevronRight />
          </button>
          <button className="menu-row" onClick={() => setSwitcher(true)}>
            <UserRound />
            <span>
              Switch local profile
              <small>{data.accounts.length} profiles on this device</small>
            </span>
            <ChevronRight />
          </button>
          <h2>Little milestones</h2>
          <div className="achievement-list">
            {account.achievements.length ? (
              account.achievements.map((a) => (
                <div key={a}>
                  <Trophy size={19} />
                  <b>{a}</b>
                </div>
              ))
            ) : (
              <p className="muted">
                Send your first hello or save a Memory to unlock a milestone.
              </p>
            )}
          </div>
          <div className="local-card">
            <b>Snapchat · Local edition</b>
            <p>
              Unofficial personal recreation. Fictional friends and simulated
              social features. Not affiliated with Snap Inc.
            </p>
          </div>
        </div>
      </div>
      {switcher && (
        <Sheet title="Local profiles" onClose={() => setSwitcher(false)}>
          {data.accounts.map((a) => (
            <button
              className="menu-row"
              key={a.id}
              onClick={() => switchAccount(a.id)}
            >
              <Avatar spec={a.avatar} />
              <span>
                {a.name}
                <small>
                  {a.username}
                  {a.id === account.id ? " · Active" : ""}
                </small>
              </span>
              <ChevronRight />
            </button>
          ))}
          <button className="primary" onClick={newAccount}>
            <Plus size={18} />
            Create local profile
          </button>
          <p className="fine">
            Profiles have separate histories but no passwords. Anyone using this
            device can switch profiles.
          </p>
        </Sheet>
      )}
    </section>
  );
}
export function AvatarScreen() {
  const { data, back, run } = useApp();
  const [avatar, setAvatar] = useState(data.account!.avatar);
  return (
    <section className="page">
      <Header title="My Avatar" />
      <div className="scroll-content padded">
        <AvatarEditor value={avatar} onChange={setAvatar} />
        <button
          className="primary"
          onClick={() =>
            void run(async () => {
              await db.accounts.update(data.account!.id, { avatar });
              back();
            })
          }
        >
          Save avatar
        </button>
      </div>
    </section>
  );
}
