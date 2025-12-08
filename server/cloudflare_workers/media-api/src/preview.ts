import { Env } from "./metadata.js";

export async function handlePreview(req: Request, env: Env) {
  const ytApiUrl = "https://liventcord-media-api.onrender.com";
  const u = new URL(req.url);

  const parts = u.pathname.split("/");
  const attachmentId = parts[2];

  if (!attachmentId || !/^[a-zA-Z0-9_-]+$/.test(attachmentId)) {
    return new Response("Invalid attachmentId", { status: 400 });
  }

  const targetUrl = new URL(`/attachments/${attachmentId}/preview`, ytApiUrl);

  const headers: Record<string, string> = {};
  if (env.ADMIN_PASSWORD) {
    headers["Authorization"] = `Bearer ${env.ADMIN_PASSWORD}`;
  }

  try {
    const response = await fetch(targetUrl.toString(), { headers });
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: response.headers,
    });
  } catch (err) {
    return new Response("Error fetching preview", { status: 500 });
  }
}
