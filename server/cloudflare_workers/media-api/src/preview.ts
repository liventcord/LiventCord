export async function handlePreview(req: Request) {
  const ytApiUrl = "https://liventcord-media-api.onrender.com";
  const u = new URL(req.url);

  const parts = u.pathname.split("/");
  const attachmentId = parts[2];

  if (!attachmentId || !/^[a-zA-Z0-9_-]+$/.test(attachmentId)) {
    return new Response("Invalid attachmentId", { status: 400 });
  }

  const targetUrl = new URL(`/attachments/${attachmentId}/preview`, ytApiUrl);

  return fetch(targetUrl.toString());
}
