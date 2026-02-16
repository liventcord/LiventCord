import { Env } from "./metadata.js";

async function streamAudio(
  req: Request,
  env: Env,
  type: "spotify" | "youtube",
  event: FetchEvent,
) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) return new Response("Invalid videoId", { status: 400 });

  const servers = env.MEDIA_API_SERVERS.split(",");
  const range = req.headers.get("Range");
  const cacheKey = new Request(`https://audio-cache.liventcord/${type}/${id}`);

  const cache = (caches as any).default;

  if (!range) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  for (const base of servers) {
    try {
      const targetUrl = new URL(`/stream/audio/${type}?id=${id}`, base);

      const headers: Record<string, string> = {};
      if (env.ADMIN_PASSWORD)
        headers["Authorization"] = `Bearer ${env.ADMIN_PASSWORD}`;

      if (range) headers["Range"] = range;

      const upstream = await fetch(targetUrl.toString(), { headers });

      if (!(upstream.status === 200 || upstream.status === 206)) continue;

      const responseHeaders = new Headers();

      for (const h of [
        "Content-Type",
        "Content-Length",
        "Content-Range",
        "Accept-Ranges",
      ]) {
        const v = upstream.headers.get(h);
        if (v) responseHeaders.set(h, v);
      }

      responseHeaders.set("Access-Control-Allow-Origin", "*");
      if (range && upstream.status === 200)
        responseHeaders.set("Accept-Ranges", "bytes");

      const body = upstream.body;

      const response = new Response(body, {
        status: upstream.status,
        headers: responseHeaders,
      });

      if (!range && upstream.status === 200) {
        response.headers.set("Cache-Control", "public, max-age=31536000");
        event.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return response;
    } catch {
      continue;
    }
  }

  return new Response("Failed streaming resource.", { status: 502 });
}

export const handleSpotify = (req: Request, env: Env, event: FetchEvent) =>
  streamAudio(req, env, "spotify", event);

export const handleYoutube = (req: Request, env: Env, event: FetchEvent) =>
  streamAudio(req, env, "youtube", event);
