import { useEffect, useState } from "react";
import { db } from "../data/db";
import { decrypt } from "../data/crypto";
export function useMediaUrl(
  mediaId: string | undefined,
  thumbnail = false,
  key: CryptoKey | null = null,
) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    let current = "";
    setUrl("");
    if (mediaId)
      (async () => {
        const [media, payload] = await Promise.all([
          db.media.get(mediaId),
          db.payloads.get(mediaId),
        ]);
        if (!payload || !media || (media.private && !key)) return;
        if (thumbnail && media.type === "video" && !payload.thumbnail) {
          if (!alive) return;
          current = URL.createObjectURL(
            new Blob(
              [
                '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect width="240" height="320" fill="#222"/><path d="M97 130l55 30-55 30z" fill="white"/></svg>',
              ],
              { type: "image/svg+xml" },
            ),
          );
          setUrl(current);
          return;
        }
        let blob = thumbnail ? payload.thumbnail || payload.blob : payload.blob;
        if (media.private) {
          if (!key) return;
          const iv = thumbnail ? payload.thumbIv || payload.iv : payload.iv;
          if (!iv) return;
          blob = await decrypt(
            blob,
            iv,
            key,
            thumbnail && payload.thumbnail ? "image/jpeg" : media.mime,
          );
        }
        if (!alive) return;
        current = URL.createObjectURL(blob);
        setUrl(current);
      })().catch(() => {});
    return () => {
      alive = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [mediaId, thumbnail, key]);
  return url;
}
