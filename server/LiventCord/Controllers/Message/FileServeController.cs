using System.Buffers;
using System.Collections.Concurrent;
using LiventCord.Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace LiventCord.Controllers
{
    public class FileCacheEntry
    {
        public string FilePath { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public DateTime LastAccessed { get; set; }
        public bool IsCompressed { get; set; }
    }

    [ApiController]
    [Route("")]
    public class FileServeController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly FileExtensionContentTypeProvider _contentTypeProvider;
        private readonly string _cacheFilePath = "FileCache";
        private string CacheDirectory => Path.Combine(Directory.GetCurrentDirectory(), _cacheFilePath);
        private readonly IAppStatsService _statsService;
        private readonly IMemoryCache _memoryCache;
        private readonly ConcurrentDictionary<string, FileCacheEntry> _fileLookupCache;

        private static readonly TimeSpan CacheEntryLifetime = TimeSpan.FromMinutes(30);

        public FileServeController(
            AppDbContext context,
            FileExtensionContentTypeProvider fileTypeProvider,
            IAppStatsService statsService,
            IMemoryCache memoryCache
        )
        {
            _context = context;
            _statsService = statsService;
            _contentTypeProvider = fileTypeProvider ?? new FileExtensionContentTypeProvider();
            _memoryCache = memoryCache;
            _fileLookupCache = new ConcurrentDictionary<string, FileCacheEntry>();

            var fullCachePath = Path.Combine(Directory.GetCurrentDirectory(), _cacheFilePath);
            if (!Directory.Exists(fullCachePath))
                Directory.CreateDirectory(fullCachePath);
        }

        private string RemoveFileExtension(string userId)
        {
            var extensionIndex = userId.LastIndexOf(".");
            if (extensionIndex > 0)
                userId = userId.Substring(0, extensionIndex);
            return userId;
        }

        private async Task<IActionResult> GetFileFromCacheOrDatabaseAsync<T>(
            string cacheFilePath,
            Func<Task<T?>>? fetchFile
        ) where T : FileBase
        {
            var fullCacheDirPath = Path.GetFullPath(CacheDirectory);
            var fullRequestedPath = Path.GetFullPath(cacheFilePath);

            if (!fullRequestedPath.StartsWith(fullCacheDirPath, StringComparison.OrdinalIgnoreCase))
                return BadRequest("Invalid file path.");

            if (System.IO.File.Exists(fullRequestedPath))
            {
                var cacheFileName = Path.GetFileName(fullRequestedPath) ?? "file.bin";
                var contentType = GetContentTypeFromFileName(cacheFileName);
                SetCacheHeaders(cacheFileName, contentType);
                _statsService.IncrementServedFiles();

                var isGzipped = cacheFileName.EndsWith(".gz", StringComparison.OrdinalIgnoreCase);

                if (isGzipped)
                {
                    return await ServeDecompressedFileAsync(fullRequestedPath, contentType);
                }

                return PhysicalFile(fullRequestedPath, contentType, enableRangeProcessing: true);
            }

            if (fetchFile == null)
                return NotFound();

            var file = await fetchFile();
            if (file == null || string.IsNullOrEmpty(file.FileName))
                return NotFound();

            var actualCachePath = Path.Combine(
                Path.GetDirectoryName(fullRequestedPath)!,
                Path.GetFileNameWithoutExtension(fullRequestedPath) + "_" + Utils.SanitizeFileName(file.FileName ?? "file.bin")
            );

            Directory.CreateDirectory(Path.GetDirectoryName(actualCachePath)!);

            await System.IO.File.WriteAllBytesAsync(actualCachePath + ".tmp", file.Content ?? Array.Empty<byte>());
            System.IO.File.Move(actualCachePath + ".tmp", actualCachePath, overwrite: true);

            _fileLookupCache.TryAdd(Path.GetFileName(actualCachePath) ?? "file.bin", new FileCacheEntry
            {
                FilePath = actualCachePath,
                ContentType = GetContentTypeFromFileName(file.FileName ?? "file.bin"),
                LastAccessed = DateTime.UtcNow,
                IsCompressed = file.FileName?.EndsWith(".gz", StringComparison.OrdinalIgnoreCase) ?? false
            });

            return await GetFileResultAsync(file);
        }

        private async Task<IActionResult> ServeDecompressedFileAsync(string filePath, string contentType)
        {
            var originalContentType = contentType.Replace(".gz", "");
            if (!_contentTypeProvider.TryGetContentType(Path.GetFileNameWithoutExtension(filePath), out var decompressedContentType))
            {
                decompressedContentType = originalContentType;
            }

            var compressedData = await System.IO.File.ReadAllBytesAsync(filePath);
            var decompressedData = FileDecompressor.DecompressGzip(compressedData);

            SetCacheHeaders(Path.GetFileNameWithoutExtension(filePath), decompressedContentType);

            return File(decompressedData, decompressedContentType, enableRangeProcessing: true);
        }

        private Task<(bool found, string cacheFilePath)> FindCachedProfileFileAsync(
            string userId,
            string? requestedVersion = null
        )
        {
            var cacheKey = $"profile_{userId}_{requestedVersion ?? "latest"}";

            if (_fileLookupCache.TryGetValue(cacheKey, out var cachedEntry))
            {
                if (System.IO.File.Exists(cachedEntry.FilePath))
                {
                    cachedEntry.LastAccessed = DateTime.UtcNow;
                    return Task.FromResult((true, cachedEntry.FilePath));
                }
                else
                {
                    _fileLookupCache.TryRemove(cacheKey, out _);
                }
            }

            if (!Directory.Exists(CacheDirectory))
                return Task.FromResult((false, string.Empty));

            var files = Directory.GetFiles(CacheDirectory)
                .Where(f =>
                    Path.GetFileName(f).StartsWith($"profile_{userId}_") &&
                    !f.EndsWith(".meta", StringComparison.OrdinalIgnoreCase) &&
                    !f.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)
                );

            if (!string.IsNullOrEmpty(requestedVersion))
            {
                files = files.Where(f =>
                    Path.GetFileName(f).StartsWith($"profile_{userId}_{requestedVersion}_")
                );
            }

            var selected = files
                .Select(f => new FileInfo(f))
                .OrderByDescending(f => f.LastWriteTime)
                .FirstOrDefault();

            if (selected == null)
                return Task.FromResult((false, string.Empty));

            _fileLookupCache.TryAdd(cacheKey, new FileCacheEntry
            {
                FilePath = selected.FullName,
                ContentType = GetContentTypeFromFileName(selected.Name),
                LastAccessed = DateTime.UtcNow,
                IsCompressed = selected.Name.EndsWith(".gz", StringComparison.OrdinalIgnoreCase)
            });

            return Task.FromResult((true, selected.FullName));
        }

        private string? FindCachedFileById(string idPrefix)
        {
            if (_fileLookupCache.TryGetValue(idPrefix, out var cachedEntry))
            {
                if (System.IO.File.Exists(cachedEntry.FilePath))
                {
                    cachedEntry.LastAccessed = DateTime.UtcNow;
                    return cachedEntry.FilePath;
                }
                else
                {
                    _fileLookupCache.TryRemove(idPrefix, out _);
                }
            }

            if (!Directory.Exists(CacheDirectory))
                return null;

            var matchingFiles = Directory.GetFiles(CacheDirectory)
                .Where(f =>
                    Path.GetFileName(f).StartsWith(idPrefix + "_") &&
                    !f.EndsWith(".meta", StringComparison.OrdinalIgnoreCase) &&
                    !f.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)
                )
                .ToList();

            var found = matchingFiles.FirstOrDefault();

            if (found != null)
            {
                _fileLookupCache.TryAdd(idPrefix, new FileCacheEntry
                {
                    FilePath = found,
                    ContentType = GetContentTypeFromFileName(Path.GetFileName(found)),
                    LastAccessed = DateTime.UtcNow,
                    IsCompressed = found.EndsWith(".gz", StringComparison.OrdinalIgnoreCase)
                });
            }

            return found;
        }

        [HttpGet("guilds/{guildId}")]
        public async Task<IActionResult> GetGuildFile(
            [FromRoute] string guildId,
            [FromQuery] string? version = null
        )
        {
            guildId = RemoveFileExtension(guildId);

            if (string.IsNullOrEmpty(guildId) || guildId.Length != Utils.ID_LENGTH || ContainsIllegalPathSegments(guildId))
                return BadRequest("Invalid guildId.");

            string? cachedPath = version != null
                ? FindCachedFileById($"guild_{guildId}_{version}")
                : FindCachedFileById($"guild_{guildId}");

            if (cachedPath != null)
                return await GetFileFromCacheOrDatabaseAsync<GuildFile>(cachedPath, null);

            var cacheKey = $"guild_db_{guildId}_{version ?? "latest"}";
            var file = await _memoryCache.GetOrCreateAsync(cacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheEntryLifetime;

                return await _context.GuildFiles
                    .AsNoTracking()
                    .Where(f => f.GuildId == guildId)
                    .OrderByDescending(f => f.CreatedAt)
                    .FirstOrDefaultAsync();
            });

            if (file == null)
                return NotFound();

            var actualVersion = version != null && version == file.Version ? version : file.Version;
            var finalCacheFilePath = Path.Combine(CacheDirectory, $"guild_{guildId}_{actualVersion}");

            return await GetFileFromCacheOrDatabaseAsync<GuildFile>(
                finalCacheFilePath,
                () => Task.FromResult<GuildFile?>(file)
            );
        }

        [HttpGet("profiles/{userId}")]
        public async Task<IActionResult> GetProfileFile(
            [FromRoute] string userId,
            [FromQuery] string? version = null
        )
        {
            userId = userId.Split('?')[0];
            userId = RemoveFileExtension(userId);

            if (userId.Length != Utils.USER_ID_LENGTH || ContainsIllegalPathSegments(userId))
                return BadRequest("Invalid userId.");

            var (cacheFound, cacheFilePath) = await FindCachedProfileFileAsync(userId, version);

            if (cacheFound)
                return await GetFileFromCacheOrDatabaseAsync<ProfileFile>(cacheFilePath, null);

            var cacheKey = $"profile_db_{userId}_{version ?? "latest"}";
            var file = await _memoryCache.GetOrCreateAsync(cacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheEntryLifetime;

                if (!string.IsNullOrEmpty(version))
                {
                    return await _context.ProfileFiles
                        .AsNoTracking()
                        .Where(f => f.UserId == userId && f.Version == version)
                        .FirstOrDefaultAsync();
                }
                else
                {
                    return await _context.ProfileFiles
                        .AsNoTracking()
                        .Where(f => f.UserId == userId)
                        .OrderByDescending(f => f.CreatedAt)
                        .FirstOrDefaultAsync();
                }
            });

            if (file == null)
                return NotFound();

            var versionPart = !string.IsNullOrEmpty(version) && version == file.Version ? version : file.Version;
            var finalCacheFilePath = Path.Combine(CacheDirectory, $"profile_{userId}_{versionPart}");

            return await GetFileFromCacheOrDatabaseAsync<ProfileFile>(
                finalCacheFilePath,
                () => Task.FromResult<ProfileFile?>(file)
            );
        }

        [HttpGet("attachments/{attachmentId}")]
        public async Task<IActionResult> GetAttachmentFile([FromRoute] string attachmentId)
        {
            attachmentId = RemoveFileExtension(attachmentId);

            if (ContainsIllegalPathSegments(attachmentId))
                return BadRequest("Invalid attachmentId.");

            var cachedPath = FindCachedFileById(attachmentId);
            if (cachedPath != null)
                return await GetFileFromCacheOrDatabaseAsync<AttachmentFile>(cachedPath, null);

            var cacheFilePath = Path.Combine(CacheDirectory, attachmentId);

            var cacheKey = $"attachment_db_{attachmentId}";
            return await GetFileFromCacheOrDatabaseAsync<AttachmentFile>(
                cacheFilePath,
                async () => await _memoryCache.GetOrCreateAsync(cacheKey, async entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow = CacheEntryLifetime;
                    return await _context.AttachmentFiles
                        .AsNoTracking()
                        .FirstOrDefaultAsync(f => f.FileId == attachmentId);
                })
            );
        }

        [HttpGet("guilds/{guildId}/emojis/{emojiId}")]
        public async Task<IActionResult> GetEmojiFile(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string emojiId
        )
        {
            if (ContainsIllegalPathSegments(guildId) || ContainsIllegalPathSegments(emojiId))
                return BadRequest("Invalid input.");

            var cacheIdPrefix = $"{guildId}_{emojiId}";
            var cachedPath = FindCachedFileById(cacheIdPrefix);
            if (cachedPath != null)
                return await GetFileFromCacheOrDatabaseAsync<EmojiFile>(cachedPath, null);

            var cacheFilePath = Path.Combine(CacheDirectory, cacheIdPrefix);

            var cacheKey = $"emoji_db_{guildId}_{emojiId}";
            return await GetFileFromCacheOrDatabaseAsync<EmojiFile>(
                cacheFilePath,
                async () => await _memoryCache.GetOrCreateAsync(cacheKey, async entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow = CacheEntryLifetime;
                    return await _context.EmojiFiles
                        .AsNoTracking()
                        .FirstOrDefaultAsync(f => f.FileId == emojiId && f.GuildId == guildId);
                })
            );
        }

        private bool ContainsIllegalPathSegments(string input)
        {
            if (string.IsNullOrEmpty(input))
                return true;

            if (input.Contains("..") || input.Contains("/") || input.Contains("\\"))
                return true;

            if (!input.All(char.IsDigit))
                return true;

            return false;
        }

        private Task<IActionResult> GetFileResultAsync(FileBase file)
        {
            if (file == null || string.IsNullOrEmpty(file.FileName))
                return Task.FromResult<IActionResult>(NotFound(new { Error = "File not found." }));

            string sanitizedFileName = Utils.SanitizeFileName(file.FileName ?? "file.bin");
            bool isCompressed = sanitizedFileName.EndsWith(".gz", StringComparison.OrdinalIgnoreCase);

            if (isCompressed)
            {
                var decompressedData = FileDecompressor.DecompressGzip(file.Content ?? Array.Empty<byte>());
                var originalFileName = sanitizedFileName.Substring(0, sanitizedFileName.Length - 3);
                string contentType = GetContentTypeFromFileName(originalFileName);

                SetCacheHeaders(originalFileName, contentType);
                _statsService.IncrementServedFiles();

                return Task.FromResult<IActionResult>(File(decompressedData, contentType, enableRangeProcessing: true));
            }
            else
            {
                string contentType = GetContentTypeFromFileName(sanitizedFileName);
                SetCacheHeaders(sanitizedFileName, contentType);
                _statsService.IncrementServedFiles();

                var stream = new MemoryStream(file.Content ?? Array.Empty<byte>());
                return Task.FromResult<IActionResult>(File(stream, contentType, enableRangeProcessing: true));
            }
        }

        private string GetContentTypeFromFileName(string fileName)
        {
            if (!_contentTypeProvider.TryGetContentType(fileName, out var contentType))
            {
                contentType = "application/octet-stream";
            }

            return contentType;
        }

        private void SetCacheHeaders(string fileName, string contentType)
        {
            Response.ContentType = contentType;
            Response.Headers["Content-Disposition"] = $"inline; filename=\"{fileName}\"";
            Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
            Response.Headers["Expires"] = DateTime.UtcNow.AddYears(1).ToString("R");
            Response.Headers["ETag"] = $"\"{fileName.GetHashCode():X}\"";
        }
    }
}