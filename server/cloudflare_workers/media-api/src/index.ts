import postgres from "postgres";
import { handleMetadata, handleProxyRequest } from "./metadata.js";
import { handlePreview } from "./preview.js";
import { handleSpotify, handleYoutube } from "./audio.js";

/* -------------------- WORKER -------------------- */

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    if (request.method === "OPTIONS") return makeResponse(null, 204);

    const url = new URL(request.url);
    const pathname = url.pathname;

    /* ---------- PREVIEW ---------- */

    const previewMatch = pathname.match(
      /^\/attachments\/([a-zA-Z0-9_-]+)\/preview$/,
    );
    if (previewMatch) {
      return handlePreview(request, env);
    }

    /* ---------- STREAM ---------- */
    if (pathname === "/stream/audio/spotify") {
      return handleSpotify(request, env);
    }
    if (pathname === "/stream/audio/youtube") {
      return handleYoutube(request, env);
    }
    /* ---------- PROXY ---------- */

    if (pathname === "/") {
      return new Response("LiventCord media worker is working!");
    }
    if (pathname === "/api/proxy/metadata" && request.method === "POST") {
      return handleMetadata(request, env);
    }

    if (pathname.startsWith("/api/proxy/media")) {
      return handleProxyRequest(request, env);
    }

    /* ---------- SETUP ---------- */

    const sql = postgres(env.HYPERDRIVE.connectionString, { prepare: false });
    const pathParts = pathname.split("/").filter(Boolean);
    const cache = (caches as any).default;

    /* ---------- DB ---------- */

    async function fetchFile(
      tableName: string,
      idField: string,
      idValue: string,
      version?: string,
    ): Promise<FetchFileResult> {
      try {
        const versionedTables = new Set(["ProfileFile", "GuildFile"]);

        const baseColumns = new Set(["guildid"]);

        const hasVersion = versionedTables.has(tableName);

        const idColumn = baseColumns.has(idField.toLowerCase())
          ? `b."${idField}"`
          : `f."${idField}"`;

        let query = `
          SELECT f.*, b.*
          FROM "${tableName}" f
          INNER JOIN "FileBase" b ON f."FileId" = b."FileId"
          WHERE ${idColumn} = $1
        `;

        const params: any[] = [idValue];

        if (version && hasVersion) {
          query += ` AND f."Version" = $2`;
          params.push(version);
        } else if (hasVersion) {
          query += ` ORDER BY f."Version" DESC`;
        }

        query += ` LIMIT 1`;

        const rows = await sql.unsafe(query, params);

        if (!rows?.length) {
          return { ok: false, status: 404, error: "File not found" };
        }

        const row = rows[0];
        const content = pickRowField(row, "Content", "content");

        if (!content) {
          return {
            ok: false,
            status: 410,
            error: "File content unavailable",
          };
        }

        return {
          ok: true,
          content,
          file_name: pickRowField(row, "FileName", "filename") || "file",
          content_type:
            pickRowField(row, "FileType", "filetype") ||
            "application/octet-stream",
        };
      } catch (err: any) {
        console.error("fetchFile error:", err);
        return {
          ok: false,
          status: 500,
          error: "Internal server error",
          debug: err?.message || String(err),
        };
      }
    }

    /* ---------- CACHE ---------- */

    async function getFromCache(key: string, fetcher?: () => Promise<any>) {
      const cacheUrl = new URL("https://cache.liventcord/" + key);

      const cached = await cache.match(cacheUrl);
      if (cached) {
        const headers = new Headers(cached.headers);
        cors(headers);
        return new Response(cached.body, { status: cached.status, headers });
      }

      if (!fetcher) return makeResponse({ error: "Not Found" }, 404);

      const file = await fetcher();
      if (!file || file.error)
        return makeResponse({ error: file?.error || "Not Found" }, 404);

      const headers = new Headers({
        "Content-Type": file.content_type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${file.file_name}"`,
      });
      cors(headers);

      if (VIDEO_MIME_TYPES.has(file.content_type)) {
        headers.set("Accept-Ranges", "bytes");
      }

      const response = new Response(file.content, {
        status: 200,
        headers,
      });

      try {
        await cache.put(cacheUrl, response.clone());
      } catch {}

      return response;
    }

    /* ---------- ROUTES ---------- */

    if (pathParts[0] === "profiles") {
      const userId = sanitizeId(stripExtension(pathParts[1] || ""));
      if (!userId) return makeResponse({ error: "Bad Request" }, 400);

      const version = url.searchParams.get("version") || undefined;
      return getFromCache(`profile_${userId}_${version || "latest"}`, () =>
        fetchFile("ProfileFile", "UserId", userId, version),
      );
    }

    if (pathParts[0] === "guilds") {
      const guildId = sanitizeId(stripExtension(pathParts[1] || ""));
      if (!guildId) return makeResponse({ error: "Bad Request" }, 400);

      if (pathParts[2] === "emojis" && pathParts[3]) {
        const emojiId = sanitizeId(stripExtension(pathParts[3]));
        return getFromCache(`emoji_${guildId}_${emojiId}`, () =>
          fetchFile("EmojiFile", "GuildId", `${guildId}|${emojiId}`),
        );
      }

      const version = url.searchParams.get("version") || undefined;
      return getFromCache(`guild_${guildId}_${version || "latest"}`, () =>
        fetchFile("GuildFile", "GuildId", guildId, version),
      );
    }

    if (pathParts[0] === "attachments") {
      const fileId = sanitizeId(stripExtension(pathParts[1] || ""));
      if (!fileId) return makeResponse({ error: "Bad Request" }, 400);

      return getFromCache(`attachment_${fileId}`, () =>
        fetchFile("AttachmentFile", "FileId", fileId),
      );
    }

    return makeResponse({ error: "Route not found" }, 404);
  },
};

/* -------------------- UTILS -------------------- */

function stripExtension(id: string) {
  return id.replace(/\.[a-z0-9]+$/i, "");
}

function sanitizeId(id: string) {
  return id.replace(/\.\./g, "").replace(/[\\/]/g, "");
}

function pickRowField(row: any, ...candidates: string[]) {
  if (!row) return undefined;
  const keys = Object.keys(row);
  const lower = keys.map((k) => k.toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i !== -1) return row[keys[i]];
  }
}

function cors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "*");
  headers.set("Access-Control-Allow-Headers", "*");
}

function makeResponse(
  body: any,
  status = 200,
  contentType = "application/json",
): Response {
  const headers = new Headers({ "Content-Type": contentType });
  cors(headers);

  let payload: BodyInit | null = null;
  if (body === null) payload = null;
  else if (body instanceof ArrayBuffer) payload = body;
  else if (ArrayBuffer.isView(body)) payload = body.buffer as any;
  else if (typeof body === "string") payload = body;
  else payload = JSON.stringify(body);

  return new Response(payload, { status, headers });
}

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

/* -------------------- TYPES -------------------- */

type FetchFileResult =
  | {
      ok: true;
      content: Uint8Array | ArrayBuffer;
      file_name: string;
      content_type: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
      debug?: string;
    };
