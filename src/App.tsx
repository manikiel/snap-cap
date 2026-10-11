import { useRef, type ReactNode } from "react";
import {
  MapPin,
  MessageSquare,
  Camera,
  Users,
  Play,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useApp, type Tab, type Route } from "./hooks/app";
import { CameraScreen } from "./screens/Camera";
import { ChatInbox, Conversation } from "./screens/Chat";
import { StoriesFeed, StoryViewer } from "./screens/Stories";
import { CapturePreview, SendTo } from "./screens/Capture";
import { Memories, MemoryDetail } from "./screens/Memories";
import { Friends, FriendshipProfile } from "./screens/Friends";
import { Profile, AvatarScreen } from "./screens/Profile";
import { SettingsScreen } from "./screens/Settings";
import { Notifications } from "./screens/Notifications";
import { CallScreen } from "./screens/Call";
import { Developer } from "./screens/Developer";
import { Onboarding } from "./screens/Onboarding";
import { Header, Empty } from "./components/ui";
const tabs: { id: Tab; label: string; icon: typeof Camera }[] = [
  { id: "map", label: "Map", icon: MapPin },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "camera", label: "Camera", icon: Camera },
  { id: "stories", label: "Stories", icon: Users },
  { id: "spotlight", label: "Spotlight", icon: Play },
];
function Informational({ map }: { map: boolean }) {
  return (
    <section className="page excluded">
      <Header title={map ? "Map" : "Spotlight"} back={false} />
      <Empty
        icon={map ? <MapPin size={43} /> : <Play size={43} />}
        title={
          map ? "Your world stays private." : "A quieter kind of Snapchat."
        }
      >
        {map
          ? "Map, location sharing and tracking are not included in this local edition. Your device location is never requested."
          : "Spotlight feeds and discovery are not included in this local edition. Your Stories and Memories are always close by."}
      </Empty>
      <div className="module-notice">
        <ShieldCheck size={20} />
        Entirely on your device
      </div>
    </section>
  );
}
function RouteScreen({ route }: { route: Route }) {
  switch (route.name) {
    case "profile":
      return <Profile />;
    case "settings":
      return <SettingsScreen />;
    case "friends":
      return <Friends />;
    case "friend":
      return <FriendshipProfile id={route.id!} />;
    case "conversation":
      return <Conversation id={route.id!} />;
    case "memories":
      return <Memories />;
    case "media":
      return <MemoryDetail id={route.id!} />;
    case "capture":
      return <CapturePreview id={route.id!} />;
    case "send":
      return <SendTo id={route.id!} />;
    case "story":
      return <StoryViewer id={route.id!} />;
    case "notifications":
      return <Notifications />;
    case "avatar":
      return <AvatarScreen />;
    case "call":
      return (
        <CallScreen
          id={route.id!}
          incoming={route.incoming}
          video={route.index === 1}
        />
      );
    case "dev":
      return <Developer />;
  }
}
export function App() {
  const { data, tab, setTab, routes } = useApp();
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const gestureDisabled = useRef(false);
  if (!data.account) return <Onboarding />;
  const route = routes.at(-1);
  return (
    <div className={`app ${tab === "camera" && !route ? "camera-mode" : ""}`}>
      <div
        className="main-stage"
        inert={!!route}
        onTouchStart={(e) => {
          gestureDisabled.current =
            !!(e.target as HTMLElement).closest(
              "button,input,textarea,select,video,.camera-tools,.zoom-control,.capture-row,.story-viewer",
            ) || e.touches.length !== 1;
          if (gestureDisabled.current || route) return;
          swipe.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            t: Date.now(),
          };
        }}
        onTouchEnd={(e) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start || gestureDisabled.current || route) return;
          const dx = e.changedTouches[0].clientX - start.x,
            dy = e.changedTouches[0].clientY - start.y;
          if (
            Math.abs(dx) < 85 ||
            Math.abs(dx) < Math.abs(dy) * 2 ||
            Date.now() - start.t > 650
          )
            return;
          const current = tabs.findIndex((t) => t.id === tab);
          const next = tabs[current + (dx < 0 ? 1 : -1)];
          if (next) setTab(next.id);
        }}
      >
        {tab === "camera" ? (
          <CameraScreen active={!route} />
        ) : tab === "chat" ? (
          <ChatInbox />
        ) : tab === "stories" ? (
          <StoriesFeed />
        ) : (
          <Informational map={tab === "map"} />
        )}
      </div>
      <nav className="bottom-nav" inert={!!route} aria-label="Main navigation">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`${tab === id ? "active" : ""} tab-${id}`}
            aria-label={label}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <div>
              <Icon
                size={id === "camera" ? 27 : 25}
                fill={
                  tab === id && id === "spotlight" ? "currentColor" : "none"
                }
              />
              {id === "chat" && data.messages.some((m) => m.unread) && (
                <i className="badge-dot" />
              )}
              {id === "stories" &&
                data.stories.some(
                  (s) =>
                    s.userId !== "me" &&
                    !s.expired &&
                    s.items.some((i) => !s.viewedItems.includes(i)),
                ) && <i className="badge-dot" />}
            </div>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {route && (
        <div
          className={`route-layer route-${route.name}`}
          key={`${route.name}-${route.id || ""}-${routes.length}`}
        >
          <RouteScreen route={route} />
        </div>
      )}
    </div>
  );
}
