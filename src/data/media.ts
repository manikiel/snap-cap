import type { Media } from "./types";
const blobFromCanvas = (canvas: HTMLCanvasElement, quality = 0.88) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Could not capture this image.")),
      "image/jpeg",
      quality,
    ),
  );
export async function preparePhoto(
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  const scale = Math.min(1, 1920 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Photo capture is unavailable.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await blobFromCanvas(canvas);
  const thumb = document.createElement("canvas");
  thumb.width = 240;
  thumb.height = Math.round((240 * canvas.height) / canvas.width);
  thumb.getContext("2d")?.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return {
    blob,
    thumbnail: await blobFromCanvas(thumb, 0.72),
    width: canvas.width,
    height: canvas.height,
  };
}
export async function prepareFile(file: File): Promise<{
  meta: Partial<Media>;
  payload: { blob: Blob; thumbnail?: Blob };
}> {
  if (file.size > 80 * 1024 * 1024)
    throw new Error("Choose a file smaller than 80 MB.");
  if (file.type.startsWith("image/") && !file.type.includes("svg")) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const photo = await preparePhoto(
        image,
        image.naturalWidth,
        image.naturalHeight,
      );
      return {
        meta: {
          type: "photo",
          title: file.name,
          width: photo.width,
          height: photo.height,
        },
        payload: photo,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (file.type.startsWith("video/")) {
    const thumb = await videoThumbnail(file);
    return {
      meta: {
        type: "video",
        title: file.name,
        duration: thumb.duration,
        width: thumb.width,
        height: thumb.height,
      },
      payload: { blob: file, thumbnail: thumb.thumbnail },
    };
  }
  throw new Error(
    "Choose a supported photo or video. HEIC support depends on Safari.",
  );
}
export async function videoThumbnail(blob: Blob) {
  const video = document.createElement("video");
  const url = URL.createObjectURL(blob);
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () =>
        reject(new Error("This video format cannot be played on this device."));
      setTimeout(() => reject(new Error("Video preview timed out.")), 10000);
    });
    if (video.duration > 0.2 || !Number.isFinite(video.duration))
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1500);
        video.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
        video.currentTime = 0.15;
      });
    const photo = await preparePhoto(
      video,
      video.videoWidth || 600,
      video.videoHeight || 1000,
    );
    return {
      thumbnail: photo.thumbnail,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      width: video.videoWidth,
      height: video.videoHeight,
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
export async function downloadBlob(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function recorderType(audio = false) {
  const types = audio
    ? ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]
    : [
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
  return types.find((t) => globalThis.MediaRecorder?.isTypeSupported(t)) || "";
}
