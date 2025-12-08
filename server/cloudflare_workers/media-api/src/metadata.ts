export interface MediaUrl {
  url: string;
  isImage: boolean;
  isVideo: boolean;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
}

export interface Metadata {
  title: string;
  description: string;
  siteName: string;
  image: string;
  url: string;
  type: string;
  keywords: string;
  author: string;
}

export interface ResultItem {
  mediaUrl: MediaUrl | null;
  metadata: Metadata | null;
}
export interface Env {
  PROXY_SERVERS: string;
}
async function fetchWithCacheAndFallback(
  url: string,
  req: Request | undefined,
  env: Env,
  proxyPath: string,
): Promise<Response> {
  const anycache = caches as any;
  const cache = anycache.default;
  const trimmed = url.trim();

  let cached = await cache.match(trimmed);
  if (cached) return cached;

  const baseHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: trimmed,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  };

  if (req && req.headers.has("Range")) {
    baseHeaders["Range"] = req.headers.get("Range")!;
  }

  const servers = env.PROXY_SERVERS.split(",");

  const attempts = [
    trimmed,
    ...servers.map(
      (base) => `${base}${proxyPath}?url=${encodeURIComponent(trimmed)}`,
    ),
  ];

  for (const target of attempts) {
    try {
      const res = await fetch(target, {
        method: req?.method || "GET",
        headers: baseHeaders,
        redirect: "follow",
      });

      if (res.ok) {
        await cache.put(trimmed, res.clone());
        return res;
      }
    } catch (_) {
      continue;
    }
  }

  return new Response("All fetch attempts failed", { status: 502 });
}
export async function handleProxyRequest(req: Request, env: Env) {
  const u = new URL(req.url);
  const target = u.searchParams.get("url");
  if (!target || !/^https?:\/\/.+/.test(target)) {
    return new Response("Invalid or missing url", { status: 400 });
  }
  return fetchWithCacheAndFallback(target, req, env, "/api/proxy/media");
}

export async function handleMetadata(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let urls: string[];
  try {
    urls = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const results: ResultItem[] = [];

  for (const raw of urls) {
    const url = raw.trim();
    if (!isAllowedHTTPS(url)) continue;

    try {
      const response = await fetchWithCacheAndFallback(
        url,
        request,
        env,
        "/api/proxy/metadata",
      );
      const type = response.headers.get("Content-Type") || "";

      let metadata: Metadata | null = null;
      let mediaUrl: MediaUrl | null = null;

      if (type.includes("text/html")) {
        const html = await response.text();
        metadata = extractMetadataFromHtml(url, html);
      }

      if (isValidMediaContentType(type)) {
        const buf = new Uint8Array(
          (await response.arrayBuffer()).slice(0, 128 * 1024),
        );
        let width = 0,
          height = 0;

        if (type.startsWith("image/")) {
          const d = getImageDimensions(buf, type);
          width = d.width;
          height = d.height;
        } else if (type.startsWith("video/")) {
          const d = getVideoDimensions(buf);
          width = d.width;
          height = d.height;
        }

        mediaUrl = {
          url,
          isImage: type.startsWith("image/"),
          isVideo: type.startsWith("video/"),
          fileName: getFileNameFromResponse(response, url),
          fileSize: parseInt(response.headers.get("Content-Length") || "0"),
          width,
          height,
        };
      }

      results.push({ metadata, mediaUrl });
    } catch {}
  }

  return new Response(JSON.stringify(results), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function getImageDimensions(buffer: Uint8Array, contentType: string) {
  try {
    if (contentType === "image/png") {
      const width =
        (buffer[16] << 24) |
        (buffer[17] << 16) |
        (buffer[18] << 8) |
        buffer[19];
      const height =
        (buffer[20] << 24) |
        (buffer[21] << 16) |
        (buffer[22] << 8) |
        buffer[23];
      return { width, height };
    }
    if (contentType === "image/gif") {
      const width = buffer[6] | (buffer[7] << 8);
      const height = buffer[8] | (buffer[9] << 8);
      return { width, height };
    }
    if (contentType === "image/jpeg") {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
        if (marker >= 0xc0 && marker <= 0xc3) {
          const height = (buffer[offset + 5] << 8) | buffer[offset + 6];
          const width = (buffer[offset + 7] << 8) | buffer[offset + 8];
          return { width, height };
        }
        offset += 2 + length;
      }
    }
    if (contentType === "image/webp") {
      const view = new DataView(buffer.buffer);
      const width = view.getUint16(26, true);
      const height = view.getUint16(28, true);
      return { width, height };
    }
    if (contentType === "image/bmp") {
      const width =
        buffer[18] |
        (buffer[19] << 8) |
        (buffer[20] << 16) |
        (buffer[21] << 24);
      const height =
        buffer[22] |
        (buffer[23] << 8) |
        (buffer[24] << 16) |
        (buffer[25] << 24);
      return { width, height };
    }
    if (
      contentType === "image/x-icon" ||
      contentType === "image/vnd.microsoft.icon"
    ) {
      const width = buffer[6] || 0;
      const height = buffer[7] || 0;
      return { width, height };
    }
  } catch {}
  return { width: 0, height: 0 };
}

function getVideoDimensions(buffer: Uint8Array) {
  let offset = 0;
  const len = buffer.length;
  while (offset + 8 < len) {
    const size = readUint32(buffer, offset);
    const type = String.fromCharCode(
      buffer[offset + 4],
      buffer[offset + 5],
      buffer[offset + 6],
      buffer[offset + 7],
    );
    if (size < 8) break;
    if (type === "tkhd") {
      const version = buffer[offset + 8];
      const widthOffset = offset + 8 + (version === 0 ? 76 : 92);
      const heightOffset = offset + 8 + (version === 0 ? 80 : 96);
      if (heightOffset + 4 <= len) {
        const width = readFixedPoint1616(buffer, widthOffset);
        const height = readFixedPoint1616(buffer, heightOffset);
        return { width, height };
      }
    }
    offset += size;
  }
  return { width: 0, height: 0 };
}

function readUint32(buffer: Uint8Array, offset: number) {
  return (
    ((buffer[offset] << 24) |
      (buffer[offset + 1] << 16) |
      (buffer[offset + 2] << 8) |
      buffer[offset + 3]) >>>
    0
  );
}

function readFixedPoint1616(buffer: Uint8Array, offset: number) {
  return readUint32(buffer, offset) >> 16;
}

function isAllowedHTTPS(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function isValidMediaContentType(contentType: string): boolean {
  return ["image/", "video/", "audio/"].some((type) =>
    contentType.startsWith(type),
  );
}

function extractMetadataFromHtml(url: string, html: string): Metadata {
  const meta: Record<string, string> = {};
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) meta.title = titleMatch[1].trim();
  const metaRegex = /<meta\s+([^>]+)>/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = match[1];
    const propertyMatch = attrs.match(/property=["']([^"']+)["']/i);
    const nameMatch = attrs.match(/name=["']([^"']+)["']/i);
    const contentMatch = attrs.match(/content=["']([^"']+)["']/i);
    const content = contentMatch ? contentMatch[1] : "";
    if (propertyMatch) meta[propertyMatch[1]] = content;
    if (nameMatch) meta[nameMatch[1]] = content;
  }
  const domain = new URL(url).hostname;
  return {
    title: firstNonEmpty(meta.title, meta["og:title"]),
    description: firstNonEmpty(meta.description, meta["og:description"]),
    siteName: firstNonEmpty(meta["og:site_name"], domain),
    image: firstNonEmpty(meta["og:image"], meta["twitter:image"]),
    url: firstNonEmpty(meta["og:url"], url),
    type: meta["og:type"] || "",
    keywords: meta.keywords || "",
    author: meta.author || "",
  };
}

function firstNonEmpty(...values: (string | undefined)[]): string {
  for (const value of values) if (value) return value;
  return "";
}

function getFileNameFromResponse(response: Response, url: string): string {
  const cd = response.headers.get("Content-Disposition");
  if (cd) {
    const match = cd.match(/filename=["']?([^"';]+)["']?/i);
    if (match) return match[1];
  }
  try {
    const segments = new URL(url).pathname.split("/");
    return segments[segments.length - 1] || "file";
  } catch {
    return "file";
  }
}
