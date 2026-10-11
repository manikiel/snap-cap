import { useState } from "react";
import { ChevronRight, Camera, ShieldCheck, Users } from "lucide-react";
import { useApp } from "../hooks/app";
import { engine } from "../data/engine";
import { defaultAvatar } from "../data/types";
import { Ghost } from "../components/ui";
import { AvatarEditor } from "../components/AvatarEditor";
export function Onboarding() {
  const { data, switchAccount, run } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [demo, setDemo] = useState(true);
  const [avatar, setAvatar] = useState(defaultAvatar);
  const [busy, setBusy] = useState(false);
  async function finish() {
    setBusy(true);
    const account = await run(() =>
      engine.createAccount(name, username, demo, avatar),
    );
    if (account) switchAccount(account.id);
    setBusy(false);
  }
  return (
    <main className={`onboarding ${step === 0 ? "welcome" : ""}`}>
      {step === 0 ? (
        <>
          <Ghost className="welcome-ghost" />
          <h1>Snapchat</h1>
          <p className="welcome-sub">
            Your little moments.
            <br />A world on your device.
          </p>
          <div className="welcome-card">
            <b>Unofficial local recreation</b>
            <p>
              Fictional friends. Real camera. Everything stays here. This app is
              not affiliated with Snap Inc. and never connects to Snapchat.
            </p>
          </div>
          <button className="primary" onClick={() => setStep(1)}>
            Create local profile <ChevronRight size={20} />
          </button>
          {data.accounts.length > 0 && (
            <div className="local-profiles">
              {data.accounts.map((a) => (
                <button
                  className="secondary"
                  key={a.id}
                  onClick={() => switchAccount(a.id)}
                >
                  Continue as {a.name}
                </button>
              ))}
            </div>
          )}
          <p className="fine">No login, passwords or network accounts.</p>
        </>
      ) : (
        <>
          <div className="onboarding-progress">
            {[1, 2, 3].map((s) => (
              <i key={s} className={s <= step ? "active" : ""} />
            ))}
          </div>
          <h1>
            {step === 1
              ? "What’s your name?"
              : step === 2
                ? "Make yourself at home."
                : "A camera for your moments."}
          </h1>
          {step === 1 ? (
            <>
              <p className="muted">
                Create a profile stored on this device. Local profiles keep
                separate histories, but are not secure accounts.
              </p>
              <label className="field">
                Display name
                <input
                  autoFocus
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="nickname"
                  placeholder="Your name"
                />
              </label>
              <label className="field">
                Username
                <input
                  value={username}
                  maxLength={24}
                  onChange={(e) =>
                    setUsername(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ""))
                  }
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Choose a username"
                />
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={demo}
                  onChange={(e) => setDemo(e.target.checked)}
                />
                Start with fictional friends and conversations
              </label>
              <button
                className="primary"
                disabled={!name.trim() || username.length < 3}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </>
          ) : step === 2 ? (
            <>
              <AvatarEditor value={avatar} onChange={setAvatar} />
              <button className="primary" onClick={() => setStep(3)}>
                Looks like me
              </button>
            </>
          ) : (
            <>
              <div className="intro-features">
                <div>
                  <Camera />
                  <b>Real photos & videos</b>
                  <p>Safari will ask before using your camera or microphone.</p>
                </div>
                <div>
                  <Users />
                  <b>A fictional social circle</b>
                  <p>
                    Chats, calls, replies and story views are simulated locally.
                  </p>
                </div>
                <div>
                  <ShieldCheck />
                  <b>You’re in control</b>
                  <p>
                    No uploads. Back up your Memories: Safari can remove local
                    data.
                  </p>
                </div>
              </div>
              <button className="primary" disabled={busy} onClick={finish}>
                {busy ? "Creating profile…" : "Open camera"}
              </button>
              <p className="fine">
                Install on iPhone: Safari → Share → Add to Home Screen.
              </p>
            </>
          )}
          <button className="text-button" onClick={() => setStep(step - 1)}>
            Back
          </button>
        </>
      )}
    </main>
  );
}
