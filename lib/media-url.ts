export type VisualMediaKind = "image" | "video" | "embed" | "unknown";
export type VideoEmbedProvider = "youtube" | "vimeo" | "bilibili" | "youku" | "unknown";

const IMAGE_PATTERN = /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const VIDEO_PATTERN = /\.(mp4|webm)(?:[?#].*)?$/i;

function safeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function youtubeId(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return "";
  if (url.pathname === "/watch") return url.searchParams.get("v") || "";
  const parts = url.pathname.split("/").filter(Boolean);
  return ["embed", "shorts", "live"].includes(parts[0]) ? parts[1] || "" : "";
}

export function getVideoEmbedProvider(value: string): VideoEmbedProvider {
  const url = safeUrl(value.trim());
  if (!url || url.protocol !== "https:") return "unknown";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (youtubeId(url)) return "youtube";
  if (host === "vimeo.com" || host === "player.vimeo.com") return "vimeo";
  if (host === "bilibili.com" || host.endsWith(".bilibili.com")) return "bilibili";
  if (host === "v.youku.com" || host === "player.youku.com") return "youku";
  return "unknown";
}

export function getVideoEmbedUrl(value: string, autoplay = false) {
  const url = safeUrl(value.trim());
  if (!url || url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const ytId = youtubeId(url);
  if (ytId && /^[A-Za-z0-9_-]{6,}$/.test(ytId)) {
    const params = new URLSearchParams({ rel: "0", playsinline: "1", modestbranding: "1", iv_load_policy: "3" });
    if (autoplay) {
      params.set("autoplay", "1");
      params.set("mute", "1");
      params.set("loop", "1");
      params.set("playlist", ytId);
      params.set("controls", "0");
      params.set("disablekb", "1");
      params.set("fs", "0");
      params.set("cc_load_policy", "0");
      params.set("autohide", "1");
    }
    return `https://www.youtube-nocookie.com/embed/${ytId}?${params}`;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
    if (id) return `https://player.vimeo.com/video/${id}?playsinline=1${autoplay ? "&autoplay=1&muted=1&loop=1&background=1" : ""}`;
  }

  if (host === "bilibili.com" || host.endsWith(".bilibili.com")) {
    const pathId = url.pathname.match(/\/(BV[A-Za-z0-9]+)/i)?.[1];
    const id = pathId || url.searchParams.get("bvid") || "";
    if (/^BV[A-Za-z0-9]+$/i.test(id)) {
      const params = new URLSearchParams({
        bvid: id,
        autoplay: autoplay ? "1" : "0",
        muted: autoplay ? "1" : "0",
        danmaku: "0",
        high_quality: "1",
        as_wide: "1",
        hide_cover_info: "1",
        noEndPanel: "1",
      });
      return `https://player.bilibili.com/player.html?${params}`;
    }
  }

  if (host === "v.youku.com" || host === "player.youku.com") {
    const id = url.pathname.match(/(?:id_|embed\/)([A-Za-z0-9=]+)/)?.[1] || "";
    if (id) return `https://player.youku.com/embed/${encodeURIComponent(id)}?autoplay=${autoplay ? "true" : "false"}&show_related=0`;
  }
  return null;
}

export function visualMediaKind(value?: string | null, mimeType?: string | null): VisualMediaKind {
  const source = value?.trim() || "";
  if (!source) return "unknown";
  if (mimeType?.startsWith("video/") || VIDEO_PATTERN.test(source)) return "video";
  if (getVideoEmbedUrl(source)) return "embed";
  if (mimeType?.startsWith("image/") || IMAGE_PATTERN.test(source) || source.startsWith("/")) return "image";
  return "unknown";
}

export function isSupportedVisualMedia(value: string) {
  const source = value.trim();
  const kind = visualMediaKind(source);
  if (kind === "unknown") return false;
  if (source.startsWith("/")) return true;
  const url = safeUrl(source);
  return Boolean(url && url.protocol === "https:");
}
