import {
  Bell,
  CheckCheck,
  MessageCircle,
  Camera,
  Eye,
  UserPlus,
  Trophy,
  Phone,
} from "lucide-react";
import { useApp } from "../hooks/app";
import { db } from "../data/db";
import { Avatar } from "../components/Avatar";
import { Header, IconButton, Empty, timeAgo } from "../components/ui";
export function Notifications() {
  const { data, open, run } = useApp();
  const activities = [...data.activities].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  const icons = {
    message: MessageCircle,
    snap: Camera,
    story: Eye,
    request: UserPlus,
    achievement: Trophy,
    call: Phone,
  };
  return (
    <section className="page">
      <Header title="Activity">
        <IconButton
          label="Mark all notifications read"
          onClick={() =>
            void run(() =>
              db.activities
                .where("accountId")
                .equals(data.account!.id)
                .modify({ read: true })
                .then(() => {}),
            )
          }
        >
          <CheckCheck />
        </IconButton>
      </Header>
      <div className="scroll-content">
        {activities.map((a) => {
          const user = data.users.find((u) => u.id === a.userId);
          const Icon = icons[a.type];
          return (
            <button
              key={a.id}
              className={`activity-row ${a.read ? "" : "unread"}`}
              onClick={() =>
                void run(async () => {
                  await db.activities.update(a.id, { read: true });
                  if (a.type === "request") open({ name: "friends" });
                  else if (a.type === "story" && a.storyId)
                    open({ name: "story", id: a.storyId });
                  else if (a.userId)
                    open({ name: "conversation", id: a.userId });
                })
              }
            >
              {user ? (
                <Avatar spec={user.avatar} />
              ) : (
                <div className="activity-icon">
                  <Icon size={22} />
                </div>
              )}
              <span>
                <p>{a.text}</p>
                <small>{timeAgo(a.createdAt)} · Local activity</small>
              </span>
              {!a.read && <i className="badge-dot" />}
            </button>
          );
        })}
        {!activities.length && (
          <Empty icon={<Bell />} title="All caught up">
            Fictional activity will appear here as you use the app.
          </Empty>
        )}
      </div>
    </section>
  );
}
