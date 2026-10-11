import { useEffect, useState } from "react";
import { Phone, PhoneOff, Mic, Volume2, Video } from "lucide-react";
import { useApp } from "../hooks/app";
import { engine } from "../data/engine";
import { Avatar } from "../components/Avatar";
import { IconButton } from "../components/ui";
export function CallScreen({
  id,
  incoming = false,
  video = false,
}: {
  id: string;
  incoming?: boolean;
  video?: boolean;
}) {
  const { data, back, run } = useApp();
  const user = data.users.find((u) => u.id === id);
  const [accepted, setAccepted] = useState(!incoming);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  useEffect(() => {
    if (!accepted) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [accepted]);
  async function end() {
    await run(() =>
      engine.send(
        data.account!.id,
        id,
        "call",
        accepted
          ? `Simulated ${video ? "video" : "voice"} call · ${seconds}s`
          : "Declined fictional call",
      ),
    );
    back();
  }
  return (
    <section className="call-screen">
      <p className="call-disclaimer">SIMULATED CALL · NO CONNECTION</p>
      <Avatar spec={user?.avatar} />
      <h1>{user?.name}</h1>
      <p>
        {accepted
          ? `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`
          : `Incoming fictional ${video ? "video" : "voice"} call…`}
      </p>
      {video && accepted && (
        <div className="fake-video">
          <Avatar spec={user?.avatar} />
          <span>
            This is a local call simulation. No camera or audio is transmitted.
          </span>
        </div>
      )}
      <div className="call-controls">
        {accepted ? (
          <>
            <IconButton
              label={
                muted
                  ? "Unmute simulated microphone"
                  : "Mute simulated microphone"
              }
              onClick={() => setMuted((v) => !v)}
            >
              <Mic className={muted ? "muted-control" : ""} />
            </IconButton>
            <IconButton
              label="Simulated speaker toggle"
              onClick={() => setSpeaker((v) => !v)}
            >
              <Volume2 className={speaker ? "active-control" : ""} />
            </IconButton>
          </>
        ) : (
          <button
            className="accept-call"
            aria-label="Accept fictional call"
            onClick={() => setAccepted(true)}
          >
            <Phone />
          </button>
        )}
        <button
          className="end-call"
          aria-label={
            accepted ? "End simulated call" : "Decline fictional call"
          }
          onClick={() => void end()}
        >
          <PhoneOff />
        </button>
      </div>
    </section>
  );
}
