import { useEffect, useRef } from "react";
import type { Media } from "../data/types";
import { useMediaUrl } from "../hooks/media";
import { useApp } from "../hooks/app";
import { Play, Lock } from "lucide-react";
export function MediaView({
  media,
  thumbnail = false,
  autoPlay = false,
  paused = false,
  onEnded,
}: {
  media: Media | undefined;
  thumbnail?: boolean;
  autoPlay?: boolean;
  paused?: boolean;
  onEnded?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const { vaultKey } = useApp();
  const url = useMediaUrl(media?.id, thumbnail, vaultKey);
  useEffect(() => {
    if (!autoPlay || !video.current) return;
    if (paused) video.current.pause();
    else video.current.play().catch(() => {});
  }, [paused, autoPlay, url]);
  if (!media)
    return <div className="media-fallback">Media no longer available</div>;
  if (!url)
    return (
      <div className="media-fallback">
        {media.private && !vaultKey ? <Lock /> : <span className="spinner" />}
      </div>
    );
  return thumbnail ? (
    <>
      <img src={url} alt={media.title} loading="lazy" decoding="async" />
      {media.type === "video" && <Play className="video-badge" size={20} />}
    </>
  ) : media.type === "video" ? (
    <video
      ref={video}
      src={url}
      playsInline
      controls={!autoPlay}
      autoPlay={autoPlay}
      onEnded={onEnded}
      preload="metadata"
    />
  ) : media.type === "audio" ? (
    <audio src={url} controls preload="metadata" />
  ) : (
    <img src={url} alt={media.title} />
  );
}
