import postgres from "postgres";
import { handleMetadata, handleProxyRequest } from "./metadata.js";
import { handlePreview } from "./preview.js";



export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    if (request.method === "OPTIONS") return makeResponse(null, 204);

    const url = new URL(request.url);
  const pathname = url.pathname
    const previewMatch = pathname.match(/^\/attachments\/([a-zA-Z0-9_-]+)\/preview$/)
    if (previewMatch) {
      return handlePreview(request)
    }

    if (url.pathname === "/api/proxy/metadata" && request.method === "POST") {
      return handleMetadata(request);
    }
    if(url.pathname.startsWith("/api/proxy/media")) {
      return handleProxyRequest(request);
    }

    const sql = postgres(env.HYPERDRIVE.connectionString, { prepare: false });
    const pathParts = url.pathname.split("/").filter(Boolean);
    const cachesany = caches as any;
    const cache = cachesany.default;

    async function fetchFile(
      tableName: string,
      idField: string,
      idValue: string,
      version?: string,
    ) {
      try {
        const columns = await getTableColumns(sql, tableName);
        const hasVersion = columns.some(
          (c: string) => c.toLowerCase() === "version",
        );

        let query;
        if (version && hasVersion) {
          query = await sql.unsafe(
            `SELECT f.*, b.* FROM "${tableName}" f
             INNER JOIN "FileBase" b ON f."FileId" = b."FileId"
             WHERE f."${idField}" = $1 AND f."Version" = $2 LIMIT 1`,
            [idValue, version],
          );
        } else if (hasVersion) {
          query = await sql.unsafe(
            `SELECT f.*, b.* FROM "${tableName}" f
             INNER JOIN "FileBase" b ON f."FileId" = b."FileId"
             WHERE f."${idField}" = $1 ORDER BY f."Version" DESC LIMIT 1`,
            [idValue],
          );
        } else {
          query = await sql.unsafe(
            `SELECT f.*, b.* FROM "${tableName}" f
             INNER JOIN "FileBase" b ON f."FileId" = b."FileId"
             WHERE f."${idField}" = $1 LIMIT 1`,
            [idValue],
          );
        }

        if (!query || query.length === 0) return { error: "File not found" };
        const row = query[0];

        const content = pickRowField(row, "Content", "content", "CONTENT");
        if (!content || (Buffer.isBuffer(content) && content.length === 0))
          return { error: "File content unavailable" };

        return {
          content,
          file_name: pickRowField(row, "FileName", "filename") || "file",
          content_type:
            pickRowField(row, "FileType", "filetype") ||
            "application/octet-stream",
        };
      } catch {
        return { error: "Internal server error" };
      }
    }

    async function fetchAttachmentSize(fileId: string) {
      try {
        const columns = await getTableColumns(sql, "AttachmentFile");
        const contentCol = columns.find((c) => c.toLowerCase() === "content");
        if (!contentCol) return { error: "Attachment not available" };

        const rows = await sql`
          SELECT octet_length(${sql(contentCol)}) AS size
          FROM ${sql("AttachmentFile")}
          WHERE "FileId" = ${fileId} LIMIT 1
        `;
        if (!rows || rows.length === 0)
          return { error: "Attachment not found" };
        return { fileId, size: rows[0].size };
      } catch {
        return { error: "Internal server error" };
      }
    }

async function getFromCache(key: string, fetcher?: () => Promise<any>) {
  const cached = await cache.match(key);
        if (cached) {
          const headers = new Headers(cached.headers);
          headers.set("Access-Control-Allow-Origin", "*");
          headers.set("Access-Control-Allow-Methods", "*");
          headers.set("Access-Control-Allow-Headers", "*");
          return new Response(cached.body, { status: cached.status, headers });
        }
  if (!fetcher) return makeResponse({ error: "Not Found" }, 404);

      const file = await fetcher();
      if (!file || file.error)
        return makeResponse({ error: file?.error || "Not Found" }, 404);

      const body =
        file.content instanceof Uint8Array ||
        file.content instanceof ArrayBuffer
          ? file.content
          : file.content;

      const headers = new Headers({
        "Content-Type": file.content_type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${file.file_name}"`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
      });
      if (VIDEO_MIME_TYPES.has(file.content_type))
        headers.set("Accept-Ranges", "bytes");

      const resp = new Response(body, { status: 200, headers });
      try {
        await cache.put(key, resp.clone());
      } catch {}
      return resp;
    }

    if (pathParts[0] === "profiles") {
      const userId = sanitizeId(pathParts[1] || "");
      if (!userId) return makeResponse({ error: "Bad Request" }, 400);
      const version = url.searchParams.get("version") || undefined;
      return getFromCache(`profile_${userId}_${version || "latest"}`, () =>
        fetchFile("ProfileFile", "UserId", userId, version),
      );
    }

    if (pathParts[0] === "guilds") {
      const guildId = sanitizeId(pathParts[1] || "");
      if (!guildId) return makeResponse({ error: "Bad Request" }, 400);

      if (pathParts[2] === "emojis" && pathParts[3]) {
        const emojiId = sanitizeId(pathParts[3]);
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
      const fileId = sanitizeId(pathParts[1] || "");
      if (!fileId) return makeResponse({ error: "Bad Request" }, 400);

      if (url.searchParams.get("size") === "true")
        return makeResponse(await fetchAttachmentSize(fileId));
      return getFromCache(`attachment_${fileId}`, () =>
        fetchFile("AttachmentFile", "FileId", fileId),
      );
    }

    return makeResponse({ error: "Route not found" }, 404);
  },
};

function sanitizeId(id: string) {
  return id.replace(/\.\./g, "").replace(/[\\/]/g, "");
}

function pickRowField(row: any | null | undefined, ...candidates: string[]) {
  if (!row) return undefined;
  const rowKeys = Object.keys(row);
  const lowerRowKeys = rowKeys.map((k) => k.toLowerCase());
  for (const c of candidates) {
    const index = lowerRowKeys.indexOf(c.toLowerCase());
    if (index !== -1) return row[rowKeys[index]];
  }
  return undefined;
}

async function getTableColumns(sql: any, tableName: string) {
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = ${tableName} AND table_schema = 'public'
  `;
  return rows.map((r: any) => r.column_name);
}

function makeResponse(
  body: any,
  status = 200,
  contentType = "application/json",
): Response {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "*");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set("Content-Type", contentType);

  let responseBody: BodyInit | null = null;

  if (body instanceof ArrayBuffer) {
    responseBody = body.slice(0);
  } else if (ArrayBuffer.isView(body)) {
    const view = body as ArrayBufferView;
    const copy = new Uint8Array(view.byteLength);
    copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    responseBody = copy.buffer;
  } else if (typeof body === "string" || body === null) {
    responseBody = body;
  } else {
    responseBody = JSON.stringify(body);
  }

  return new Response(responseBody, { status, headers });
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
