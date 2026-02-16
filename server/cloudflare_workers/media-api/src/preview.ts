import { Env } from "./metadata.js";

export async function handlePreview(req: Request, env: Env) {
  const u = new URL(req.url);
  const parts = u.pathname.split("/");
  const attachmentId = parts[2];

  if (!attachmentId || !/^[a-zA-Z0-9_-]+$/.test(attachmentId)) {
    return new Response("Invalid attachmentId", { status: 400 });
  }

  const servers = env.MEDIA_API_SERVERS.split(",");

  for (const base of servers) {
    try {
      const targetUrl = new URL(`/attachments/${attachmentId}/preview`, base);

      const headers: Record<string, string> = {};

      if (env.ADMIN_PASSWORD) {
        headers["Authorization"] = `Bearer ${env.ADMIN_PASSWORD}`;
      }

      const response = await fetch(targetUrl.toString(), { headers });

      if (!response.ok) {
        continue;
      }

      return new Response(await response.arrayBuffer(), {
        status: response.status,
        headers: response.headers,
      });
    } catch {
      continue;
    }
  }

  return new Response("All proxy servers failed", { status: 502 });
}
