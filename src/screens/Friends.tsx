import { useState } from "react";
import {
  Users,
  Plus,
  MessageCircle,
  Camera,
  ShieldBan,
  UserMinus,
  Check,
  ChevronRight,
  Heart,
  Gift,
  CalendarDays,
} from "lucide-react";
import { useApp } from "../hooks/app";
import { engine } from "../data/engine";
import { Avatar } from "../components/Avatar";
import {
  Header,
  SearchBox,
  IconButton,
  Confirm,
  Empty,
} from "../components/ui";
export function Friends() {
  const { data, open, run, toast } = useApp();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("My Friends");
  const users = data.users.filter(
    (u) =>
      `${u.name} ${u.username}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "My Friends"
        ? data.friends.some((f) => f.userId === u.id && f.status === "friend")
        : filter === "Requests"
          ? data.friends.some(
              (f) =>
                f.userId === u.id &&
                ["incoming", "requested"].includes(f.status),
            )
          : !data.friends.some(
              (f) =>
                f.userId === u.id &&
                ["friend", "blocked", "incoming", "requested"].includes(
                  f.status,
                ),
            )),
  );
  return (
    <section className="page">
      <Header title="Add Friends" />
      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search fictional friends"
      />
      <div className="filter-chips">
        {["My Friends", "Requests", "Suggestions"].map((t) => (
          <button
            key={t}
            className={t === filter ? "active" : ""}
            onClick={() => setFilter(t)}
          >
            {t}
            {t === "Requests" &&
              data.friends.some((f) => f.status === "incoming") && (
                <i className="badge-dot" />
              )}
          </button>
        ))}
      </div>
      <div className="scroll-content">
        {users.map((u) => {
          const status = data.friends.find((f) => f.userId === u.id)?.status;
          return (
            <div className="friend-row" key={u.id}>
              <button
                className="friend-row-info"
                onClick={() => open({ name: "friend", id: u.id })}
              >
                <Avatar spec={u.avatar} />
                <span>
                  <b>{u.name}</b>
                  <small>{u.username}</small>
                </span>
              </button>
              {status === "friend" ? (
                <IconButton
                  label={`Chat with ${u.name}`}
                  onClick={() => open({ name: "conversation", id: u.id })}
                >
                  <MessageCircle size={23} />
                </IconButton>
              ) : (
                <button
                  className="small-pill"
                  onClick={() =>
                    void run(async () => {
                      await engine.setFriend(
                        data.account!.id,
                        u.id,
                        status === "incoming" || status === "requested"
                          ? "friend"
                          : "requested",
                      );
                      toast(
                        status === "incoming" || status === "requested"
                          ? "Friend added to your local circle."
                          : "Local request created. Accept it from Requests to continue.",
                      );
                    })
                  }
                >
                  {status === "incoming"
                    ? "Accept"
                    : status === "requested"
                      ? "Accept locally"
                      : "+ Add"}
                </button>
              )}
            </div>
          );
        })}
        {!users.length && (
          <Empty icon={<Users />} title="No friends here yet">
            Try another filter or search. Every account in this directory is
            fictional.
          </Empty>
        )}
        <p className="inbox-note">
          A fictional directory. No contacts are accessed or uploaded.
        </p>
      </div>
    </section>
  );
}
export function FriendshipProfile({ id }: { id: string }) {
  const { data, open, run, toast } = useApp();
  const user = data.users.find((u) => u.id === id);
  const friend = data.friends.find((f) => f.userId === id);
  const [confirm, setConfirm] = useState<"removed" | "blocked" | null>(null);
  if (!user)
    return (
      <Empty icon={<Users />} title="Profile unavailable">
        This fictional account is not available.
      </Empty>
    );
  const best = (friend?.interactions || 0) >= 3;
  const anniversary = new Date(friend?.since || Date.now());
  anniversary.setFullYear(new Date().getFullYear());
  if (anniversary.getTime() < Date.now())
    anniversary.setFullYear(anniversary.getFullYear() + 1);
  const anniversaryDays = Math.ceil(
    (anniversary.getTime() - Date.now()) / 86400000,
  );
  return (
    <section className="page friendship-profile">
      <Header title="Friendship" />
      <div className="scroll-content">
        <div
          className="friendship-hero"
          style={{ background: user.avatar.background }}
        >
          <Avatar spec={user.avatar} />
          <h1>{user.name}</h1>
          <p>{user.username} · Fictional account</p>
        </div>
        <div className="profile-body">
          <p className="profile-bio">{user.bio}</p>
          {friend?.status === "friend" ? (
            <div className="friendship-actions">
              <button
                className="primary"
                onClick={() => open({ name: "conversation", id })}
              >
                <MessageCircle size={19} />
                Chat
              </button>
              <button
                className="secondary"
                onClick={() => open({ name: "memories" })}
              >
                <Camera size={19} />
                Send Snap
              </button>
            </div>
          ) : (
            <button
              className="primary"
              onClick={() =>
                void run(async () => {
                  await engine.setFriend(
                    data.account!.id,
                    id,
                    friend?.status === "incoming" ||
                      friend?.status === "requested"
                      ? "friend"
                      : "requested",
                  );
                  toast(
                    friend?.status === "blocked"
                      ? "Unblocked. A local request has been created."
                      : "Local friendship updated.",
                  );
                })
              }
            >
              {friend?.status === "blocked"
                ? "Unblock and request"
                : friend?.status === "incoming" ||
                    friend?.status === "requested"
                  ? "Accept local friendship"
                  : "Add fictional friend"}
            </button>
          )}
          <div className="friendship-stats">
            <div>
              <b>{friend?.streak || 0} 🔥</b>
              <span>Local Snapstreak</span>
            </div>
            <div>
              <b>{best ? "💛" : "🙂"}</b>
              <span>{best ? "Best Friends" : "Friends"}</span>
            </div>
          </div>
          <h2>Friendship details</h2>
          <div className="detail-row">
            <Gift />
            <span>Birthday</span>
            <b>
              {new Date(`${user.birthday}T12:00:00`).toLocaleDateString(
                undefined,
                { month: "long", day: "numeric" },
              )}
            </b>
          </div>
          {friend && (
            <div className="detail-row">
              <CalendarDays />
              <span>Friends since</span>
              <b>
                {new Date(friend.since).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </b>
            </div>
          )}
          {friend?.status === "friend" && (
            <div className="detail-row">
              <Heart />
              <span>Next anniversary</span>
              <b>
                {anniversary.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {anniversaryDays} days
              </b>
            </div>
          )}
          <p className="fine">
            {best ? "You’ve interacted often in this local simulation. " : ""}A
            streak grows once per UTC day when a snap is sent and a fictional
            friend opens it. Missing a day resets the counter.
          </p>
          <h2>Stories</h2>
          {data.stories
            .filter((s) => s.userId === id && !s.expired && s.items.length)
            .map((s) => (
              <button
                key={s.id}
                className="menu-row"
                disabled={friend?.status !== "friend"}
                onClick={() => open({ name: "story", id: s.id })}
              >
                <Avatar spec={user.avatar} />
                View local Story
                <ChevronRight />
              </button>
            ))}
          <h2>Manage friendship</h2>
          {friend?.status !== "blocked" && (
            <button
              className="menu-row danger-text"
              onClick={() => setConfirm("blocked")}
            >
              <ShieldBan />
              Block fictional friend
            </button>
          )}
          {friend?.status === "friend" && (
            <button
              className="menu-row danger-text"
              onClick={() => setConfirm("removed")}
            >
              <UserMinus />
              Remove friend
            </button>
          )}
          <p className="fine">
            Blocking prevents new local messages and simulated interactions.
            Existing history stays on this device.
          </p>
        </div>
      </div>
      {confirm && (
        <Confirm
          title={confirm === "blocked" ? "Block friend" : "Remove friend"}
          text={
            confirm === "blocked"
              ? "This stops pending simulation events and new interactions with this fictional friend."
              : "This removes the fictional friend from your local circle. Conversation history is preserved."
          }
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            void run(async () => {
              await engine.setFriend(data.account!.id, id, confirm);
              setConfirm(null);
              toast("Local friendship updated.");
            })
          }
        />
      )}
    </section>
  );
}
