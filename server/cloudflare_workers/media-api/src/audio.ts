import { Env } from "./metadata.js";

async function streamAudio(
  req: Request,
  env: Env,
  type: "spotify" | "youtube",
) {
  console.log("Received audio: ", req.url);
  const u = new URL(req.url);
  const id = u.searchParams.get("id");

  if (!id) {
    return new Response("Invalid videoId", { status: 400 });
  }

  const servers = env.PROXY_SERVERS.split(",");
  const range = req.headers.get("Range");

  for (const base of servers) {
    try {
      const targetUrl = new URL(`/stream/audio/${type}?id=${id}`, base);

      const headers: Record<string, string> = {};

      if (env.ADMIN_PASSWORD) {
        headers["Authorization"] = `Bearer ${env.ADMIN_PASSWORD}`;
      }

      if (range) {
        headers["Range"] = range;
      }

      const upstream = await fetch(targetUrl.toString(), { headers });

      if (!(upstream.status === 200 || upstream.status === 206)) {
        continue;
      }

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

      if (range && upstream.status === 200) {
        responseHeaders.set("Accept-Ranges", "bytes");
      }

      // Add CORS header
      responseHeaders.set("Access-Control-Allow-Origin", "*");

      const stream = new ReadableStream({
        async start(controller) {
          const reader = upstream.body!.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch {
      continue;
    }
  }

  return new Response("All proxy servers failed", { status: 502 });
}

export const handleSpotify = (req: Request, env: Env) =>
  streamAudio(req, env, "spotify");

export const handleYoutube = (req: Request, env: Env) =>
  streamAudio(req, env, "youtube");
