import { handleMetadata, handleProxyRequest } from "./metadata.js";
import { handlePreview } from "./preview.js";
import { handleSpotify, handleYoutube } from "./audio.js";
import { handleGifRequest } from "./gifs.js";

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/avi",
  "video/mov",
  "video/wmv",
  "video/flv",
  "video/mkv",
  "video/3gp",
  "video/quicktime",
]);

function cors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "*");
  headers.set("Access-Control-Allow-Headers", "*");
}

function jsonResponse(body: unknown, status = 200): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  cors(headers);
  return new Response(JSON.stringify(body), { status, headers });
}

function sanitize(id: string): string {
  return id
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\.\./g, "")
    .replace(/[\\/]/g, "");
}

async function fileResponse(resp: Response, range?: string): Promise<Response> {
  const headers = new Headers(resp.headers);
  cors(headers);

  return new Response(resp.body, {
    status: resp.status,
    headers,
  });
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    if (request.method === "OPTIONS") return jsonResponse(null, 204);

    const url = new URL(request.url);
    const path = url.pathname;
    const cache = (caches as any).default;
    const originBase = env.LIVENTCORD_SERVER_URL;

    if (path.match(/^\/attachments\/[a-zA-Z0-9_-]+\/preview$/))
      return handlePreview(request, env);
    if (path === "/stream/audio/spotify")
      return handleSpotify(request, env, ctx);
    if (path === "/stream/audio/youtube")
      return handleYoutube(request, env, ctx);
    if (path === "/")
      return new Response("LiventCord media worker is working!");
    if (path === "/api/v1/proxy/metadata" && request.method === "POST")
      return handleMetadata(request, env);
    if (path.startsWith("/api/v1/proxy/media"))
      return handleProxyRequest(request, env);
    if (path.startsWith("/api/v1/gifs")) return handleGifRequest(request, env);

    const parts = path.split("/").filter(Boolean);
    if (!parts.length) return jsonResponse({ error: "Route not found" }, 404);

    const resourceMap: Record<string, string> = {
      profiles: "profiles",
      attachments: "attachments",
      guilds: "guilds",
      emojis: "emojis",
    };

    async function fetchFromOrigin(type: string, id: string, version?: string) {
      const cacheKey = `https://cache.liventcord/${type}_${id}_${version ?? "latest"}`;
      const cacheUrl = new URL(cacheKey);

      const rangeHeader = request.headers.get("Range") || undefined;

      if (!rangeHeader) {
        const cached = await cache.match(cacheUrl);
        if (cached) return fileResponse(cached);
      }

      try {
        const originUrl = new URL(originBase);
        originUrl.pathname = `/${type}/${id}`;
        if (version) originUrl.searchParams.set("version", version);

        const resp = await fetch(originUrl.toString(), {
          headers: rangeHeader ? { Range: rangeHeader } : undefined,
        });

        if (!resp.ok)
          return jsonResponse({ error: "File not found" }, resp.status);

        const responseToReturn = await fileResponse(resp, rangeHeader);

        if (!rangeHeader && resp.status === 200)
          ctx.waitUntil(cache.put(cacheUrl, responseToReturn.clone()));

        return responseToReturn;
      } catch (err) {
        console.error("fetchFromOrigin error:", err);
        return jsonResponse({ error: "Failed to fetch from origin" }, 500);
      }
    }

    if (parts[0] in resourceMap) {
      const type = resourceMap[parts[0]];
      const id = sanitize(parts[1] || "");
      if (!id) return jsonResponse({ error: "Bad Request" }, 400);

      const version = url.searchParams.get("version") || undefined;

      if (type === "guilds" && parts[2] === "emojis" && parts[3]) {
        const emojiId = sanitize(parts[3]);
        return fetchFromOrigin("guilds/emojis", emojiId);
      }

      return fetchFromOrigin(type, id, version);
    }

    return jsonResponse({ error: "Route not found" }, 404);
  },
};
