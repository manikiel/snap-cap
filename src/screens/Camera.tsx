import { useEffect, useRef, useState } from "react";
import {
  Camera as CameraIcon,
  CameraOff,
  SwitchCamera,
  Zap,
  ZapOff,
  Images,
  Search,
  ChevronDown,
  Info,
  Plus,
} from "lucide-react";
import { useApp } from "../hooks/app";
import { engine } from "../data/engine";
import { preparePhoto, recorderType, videoThumbnail } from "../data/media";
import { Avatar } from "../components/Avatar";
import { IconButton } from "../components/ui";
type Hardware = {
  zoom?: { min: number; max: number; step: number };
  torch?: boolean;
  focusMode?: string[];
  pointsOfInterest?: unknown;
};
export function CameraScreen({ active }: { active: boolean }) {
  const { data, open, run, toast } = useApp();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem("snap-cap-camera") === "enabled",
  );
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [previewReady, setPreviewReady] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "denied" | "unsupported"
  >("idle");
  const [error, setError] = useState("");
  const [caps, setCaps] = useState<Hardware>({});
  const [zoom, setZoom] = useState(1);
  const [torch, setTorch] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const holding = useRef(false);
  const longPress = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStart = useRef(0);
  const duration = useRef(0);
  const [silent, setSilent] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const stop = () => {
      holding.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      microphone.current?.getTracks().forEach((t) => t.stop());
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
    if (!active || !enabled) {
      stop();
      setStatus("idle");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    setStatus("loading");
    setPreviewReady(false);
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        const track = s.getVideoTracks()[0];
        const c = (track.getCapabilities?.() as Hardware) || {};
        setCaps(c);
        setZoom(track.getSettings().zoom || c.zoom?.min || 1);
        setTorch(false);
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
        setStatus("ready");
        localStorage.setItem("snap-cap-camera", "enabled");
      })
      .catch((e) => {
        setStatus(e.name === "NotAllowedError" ? "denied" : "idle");
        setError(
          e.name === "NotAllowedError"
            ? "Camera access was denied. Allow it in Safari’s website settings, then try again."
            : e.name === "NotFoundError"
              ? "No camera was found on this device. You can import a photo in Memories."
              : "The camera is busy or unavailable. Close other camera apps and try again.",
        );
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, facing, active]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - recordingStart.current) / 1000;
      setSeconds(elapsed);
      if (elapsed >= 30) stopRecording();
    }, 100);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(
    () => () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    },
    [],
  );
  async function capture() {
    if (status !== "ready" || busy || !video.current?.videoWidth) return;
    setBusy(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    const media = await run(async () => {
      const photo = await preparePhoto(
        video.current!,
        video.current!.videoWidth,
        video.current!.videoHeight,
      );
      return engine.saveMedia(
        data.account!.id,
        {
          type: "photo",
          saved: false,
          title: "Camera snap",
          width: photo.width,
          height: photo.height,
        },
        photo,
      );
    });
    if (media && activeRef.current) open({ name: "capture", id: media.id });
    setBusy(false);
  }
  async function startRecording() {
    if (status !== "ready" || !stream.current || !globalThis.MediaRecorder) {
      toast(
        "Video recording is unavailable in this browser. You can still take photos.",
      );
      return;
    }
    setBusy(true);
    let audio: MediaStream | null = null;
    try {
      audio = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast(
        "Microphone access is unavailable. This video will be recorded without sound.",
      );
    }
    if (!holding.current || !stream.current || !activeRef.current) {
      audio?.getTracks().forEach((t) => t.stop());
      setBusy(false);
      return;
    }
    microphone.current = audio;
    setSilent(!audio);
    const combined = new MediaStream([
      ...stream.current.getVideoTracks(),
      ...(audio?.getAudioTracks() || []),
    ]);
    try {
      const type = recorderType();
      const r = new MediaRecorder(
        combined,
        type ? { mimeType: type } : undefined,
      );
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onerror = () => {
        toast("Recording failed. Please try a shorter video.");
        setRecording(false);
        setBusy(false);
      };
      r.onstop = async () => {
        audio?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (!activeRef.current) return;
        const blob = new Blob(chunks, { type: r.mimeType });
        const elapsed = duration.current;
        const media = await run(async () => {
          let thumbnail: Blob | undefined;
          try {
            thumbnail = (await videoThumbnail(blob)).thumbnail;
          } catch {
            /* Video remains playable when thumbnail extraction is unavailable. */
          }
          return engine.saveMedia(
            data.account!.id,
            {
              type: "video",
              saved: false,
              title: "Video snap",
              duration: elapsed,
            },
            { blob, thumbnail },
          );
        });
        if (media && activeRef.current) open({ name: "capture", id: media.id });
        setBusy(false);
      };
      recorder.current = r;
      recordingStart.current = Date.now();
      duration.current = 0;
      r.start(250);
      setRecording(true);
      setSeconds(0);
      setBusy(false);
    } catch {
      audio?.getTracks().forEach((t) => t.stop());
      setBusy(false);
      toast(
        "This browser could not start video recording. Try a photo instead.",
      );
    }
  }
  function stopRecording() {
    duration.current = (Date.now() - recordingStart.current) / 1000;
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
    setBusy(true);
  }
  async function hardware(values: Record<string, unknown>) {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return false;
    try {
      await track.applyConstraints({
        advanced: [values],
      } as MediaTrackConstraints);
      return true;
    } catch {
      toast("The camera could not apply that hardware setting.");
      return false;
    }
  }
  async function changeZoom(value: number) {
    if (!caps.zoom) return;
    const next = Math.min(caps.zoom.max, Math.max(caps.zoom.min, value));
    if (await hardware({ zoom: next }))
      setZoom(stream.current?.getVideoTracks()[0].getSettings().zoom || next);
  }
  const pointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const pointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current && caps.zoom) {
      const [a, b] = [...pointers.current.values()];
      changeZoom(
        (pinchStart.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
          pinchStart.current.distance,
      );
    }
  };
  return (
    <section className="camera-screen" aria-label="Camera">
      <video
        ref={video}
        className={`camera-preview ${facing === "user" ? "mirrored" : ""}`}
        onLoadedData={() => setPreviewReady(true)}
        muted
        playsInline
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          pinchStart.current = null;
        }}
        onPointerCancel={() => {
          pointers.current.clear();
          pinchStart.current = null;
        }}
      />
      {flash && <div className="capture-flash" />}
      <div className="camera-top">
        <button
          className="avatar-button"
          aria-label="My profile"
          onClick={() => open({ name: "profile" })}
        >
          <Avatar spec={data.account?.avatar} />
        </button>
        <IconButton
          label="Search friends"
          onClick={() => open({ name: "friends" })}
        >
          <Search />
        </IconButton>
        <div className="camera-brand">Snapchat</div>
        <IconButton
          label="Add friends"
          onClick={() => open({ name: "friends" })}
        >
          <Plus />
        </IconButton>
      </div>
      <div className="camera-tools">
        <IconButton
          label="Switch camera"
          disabled={recording || busy}
          onClick={() =>
            setFacing((f) => (f === "user" ? "environment" : "user"))
          }
        >
          <SwitchCamera />
        </IconButton>
        <IconButton
          label={
            caps.torch
              ? "Toggle camera torch"
              : "Flash unavailable on this camera"
          }
          onClick={async () => {
            if (caps.torch) {
              if (await hardware({ torch: !torch })) setTorch(!torch);
            } else
              toast(
                "This camera does not expose a physical flash or torch to Safari.",
              );
          }}
        >
          {torch ? <Zap /> : <ZapOff />}
        </IconButton>
        <IconButton
          label="Camera capabilities"
          onClick={() =>
            toast(
              `Camera ${status === "ready" ? "ready" : "not active"} · ${caps.zoom ? "hardware zoom supported" : "zoom unavailable"} · ${caps.torch ? "torch supported" : "flash unavailable"} · tap-to-focus is not exposed by this browser.`,
            )
          }
        >
          <Info />
        </IconButton>
        <ChevronDown size={20} />
      </div>
      {status !== "ready" && (
        <div className="camera-permission">
          {status === "loading" ? (
            <span className="spinner" />
          ) : status === "denied" ? (
            <CameraOff size={44} />
          ) : (
            <CameraIcon size={44} />
          )}
          <h2>
            {status === "loading"
              ? "Opening camera…"
              : status === "denied"
                ? "Let’s try that again."
                : "Capture a little moment."}
          </h2>
          <p>
            {error ||
              "Your camera stays on your device. No photos or videos are uploaded."}
          </p>
          {status !== "loading" && status !== "unsupported" && (
            <button
              className="primary"
              onClick={() => {
                setError("");
                setEnabled(false);
                setTimeout(() => setEnabled(true), 0);
              }}
            >
              Enable camera
            </button>
          )}
          <button
            className="camera-link"
            onClick={() => open({ name: "memories" })}
          >
            Open Memories instead
          </button>
        </div>
      )}
      {recording && (
        <div className="recording-timer">
          <i />
          {Math.floor(seconds).toString().padStart(2, "0")}:30{" "}
          {silent ? " · Silent video" : ""}
        </div>
      )}
      {caps.zoom && status === "ready" && (
        <label className="zoom-control">
          {zoom.toFixed(1)}×
          <input
            aria-label="Camera zoom"
            type="range"
            min={caps.zoom.min}
            max={caps.zoom.max}
            step={caps.zoom.step || 0.1}
            value={zoom}
            onChange={(e) => changeZoom(+e.target.value)}
          />
        </label>
      )}
      <div className="camera-bottom">
        <div className="capture-row">
          <IconButton
            label="Memories"
            onClick={() => open({ name: "memories" })}
          >
            <Images size={29} />
          </IconButton>
          <button
            className={`capture-button ${recording ? "recording" : ""}`}
            aria-label={
              recording ? "Stop recording" : "Capture photo; hold for video"
            }
            disabled={status !== "ready" || busy || !previewReady}
            onPointerDown={(e) => {
              if (status !== "ready") return;
              e.currentTarget.setPointerCapture(e.pointerId);
              holding.current = true;
              longPress.current = false;
              pressTimer.current = setTimeout(() => {
                longPress.current = true;
                void startRecording();
              }, 350);
            }}
            onPointerUp={() => {
              holding.current = false;
              if (pressTimer.current) clearTimeout(pressTimer.current);
              if (recording) stopRecording();
              else if (!longPress.current) void capture();
            }}
            onPointerCancel={() => {
              holding.current = false;
              if (pressTimer.current) clearTimeout(pressTimer.current);
              if (recording) stopRecording();
            }}
            onClick={(e) => {
              if (e.detail === 0) recording ? stopRecording() : void capture();
            }}
          >
            <span />
          </button>
          <button
            className="camera-gallery"
            aria-label="Import photo or video"
            onClick={() => open({ name: "memories" })}
          >
            <Images size={25} />
          </button>
        </div>
        <p className="camera-hint">
          {recording
            ? "Release to finish · 30 seconds maximum"
            : "Tap for photo · Hold for video"}
        </p>
      </div>
    </section>
  );
}
