using System.Diagnostics;
using FileTypeChecker;
using LiventCord.Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using MimeKit;


namespace LiventCord.Controllers
{
    [ApiController]
    [Route("")]
    public class FileServeController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly FileExtensionContentTypeProvider _fileTypeProvider;
        private readonly IWebHostEnvironment _env;
        private readonly PermissionsController _permissionsController;
        private readonly string _cacheFilePath = "FileCache";
        private string CacheDirectory =>
            Path.Combine(Directory.GetCurrentDirectory(), _cacheFilePath);
        private readonly IAppStatsService _statsService;
        private readonly ILogger<FileServeController> _logger;

        private static readonly HashSet<string> VideoMimeTypes = new HashSet<string>(
            StringComparer.OrdinalIgnoreCase
        )
        {
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
        };

        public FileServeController(
            AppDbContext context,
            FileExtensionContentTypeProvider fileTypeProvider,
            IWebHostEnvironment env,
            PermissionsController permissionsController,
            IAppStatsService statsService,
            ILogger<FileServeController> logger
        )
        {
            _context = context;
            _statsService = statsService;
            _fileTypeProvider = fileTypeProvider ?? new FileExtensionContentTypeProvider();
            _env = env;
            _permissionsController = permissionsController;
            _logger = logger;

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

        private async Task<IActionResult> GetFileFromCacheOrDatabase(
            string cacheFilePath,
            Func<Task<IActionResult>>? fetchFile,
            string fileName
        )
        {
            var fullCacheDirPath = Path.GetFullPath(CacheDirectory);
            var fullRequestedPath = Path.GetFullPath(cacheFilePath);

            if (!fullRequestedPath.StartsWith(fullCacheDirPath, StringComparison.OrdinalIgnoreCase))
                return BadRequest("Invalid file path.");

            var metaPath = fullRequestedPath + ".meta";

            if (System.IO.File.Exists(fullRequestedPath) && System.IO.File.Exists(metaPath))
            {
                string contentType = await System.IO.File.ReadAllTextAsync(metaPath);

                if (IsVideoContent(contentType))
                {
                    SetCacheHeaders(fileName);
                    _statsService.IncrementServedFiles();
                    return PhysicalFile(
                        fullRequestedPath,
                        contentType,
                        fileName,
                        enableRangeProcessing: true
                    );
                }

                byte[] fileBytes = await System.IO.File.ReadAllBytesAsync(fullRequestedPath);
                SetCacheHeaders(fileName);
                _statsService.IncrementServedFiles();
                return File(fileBytes, contentType);
            }

            if (fetchFile == null)
                return NotFound();

            var result = await fetchFile();

            if (result is FileContentResult fileResult)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(fullRequestedPath)!);

                await System.IO.File.WriteAllBytesAsync(
                    fullRequestedPath + ".tmp",
                    fileResult.FileContents
                );
                await System.IO.File.WriteAllTextAsync(
                    metaPath + ".tmp",
                    fileResult.ContentType ?? "application/octet-stream"
                );

                System.IO.File.Move(fullRequestedPath + ".tmp", fullRequestedPath, overwrite: true);
                System.IO.File.Move(metaPath + ".tmp", metaPath, overwrite: true);
            }

            return result;
        }

        private bool IsVideoContent(string contentType)
        {
            return VideoMimeTypes.Contains(contentType);
        }

        private Task<(bool found, string cacheFilePath)> FindCachedProfileFile(
            string userId,
            string? requestedVersion = null
        )
        {
            var cachePattern = Path.Combine(CacheDirectory, $"profile_{userId}_*.file");
            var cacheDir = Path.GetDirectoryName(cachePattern);
            var searchPattern = Path.GetFileName(cachePattern);

            if (!Directory.Exists(cacheDir))
                return Task.FromResult((false, string.Empty));

            var matchingFiles = Directory.GetFiles(cacheDir, searchPattern);

            if (!string.IsNullOrEmpty(requestedVersion))
            {
                var specificVersionPath = Path.Combine(
                    CacheDirectory,
                    $"profile_{userId}_{requestedVersion}.file"
                );
                if (matchingFiles.Contains(specificVersionPath))
                    return Task.FromResult((true, specificVersionPath));
            }

            if (matchingFiles.Length > 0)
            {
                var mostRecentFile = matchingFiles
                    .Select(f => new FileInfo(f))
                    .OrderByDescending(f => f.LastWriteTime)
                    .First();
                return Task.FromResult((true, mostRecentFile.FullName));
            }

            return Task.FromResult((false, string.Empty));
        }
        [DisableControllerIfPostgres]
        [HttpGet("guilds/{guildId}")]
        public async Task<IActionResult> GetGuildFile(
            [FromRoute] string guildId,
            [FromQuery] string? version = null
        )
        {
            guildId = RemoveFileExtension(guildId);

            if (
                string.IsNullOrEmpty(guildId)
                || guildId.Length != 19
                || ContainsIllegalPathSegments(guildId)
            )
                return BadRequest("Invalid guildId.");

            var cachePattern = Path.Combine(CacheDirectory, $"guild_{guildId}_*.file");
            var cacheDir = Path.GetDirectoryName(cachePattern);
            var searchPattern = Path.GetFileName(cachePattern);

            string? cachedPath = null;
            if (Directory.Exists(cacheDir))
            {
                var matchingFiles = Directory.GetFiles(cacheDir, searchPattern);
                if (!string.IsNullOrEmpty(version))
                {
                    var specificVersionPath = Path.Combine(
                        CacheDirectory,
                        $"guild_{guildId}_{version}.file"
                    );
                    if (matchingFiles.Contains(specificVersionPath))
                        cachedPath = specificVersionPath;
                }

                if (cachedPath == null && matchingFiles.Length > 0)
                    cachedPath = matchingFiles
                        .Select(f => new FileInfo(f))
                        .OrderByDescending(f => f.LastWriteTime)
                        .First()
                        .FullName;
            }

            if (cachedPath != null)
                return await GetFileFromCacheOrDatabase(cachedPath, null, guildId);

            var file = await _context.GuildFiles.FirstOrDefaultAsync(f => f.GuildId == guildId);
            if (file == null)
                return NotFound();

            var versionPart =
                !string.IsNullOrEmpty(version) && version == file.Version ? version : file.Version;
            var finalCacheFilePath = Path.Combine(
                CacheDirectory,
                $"guild_{guildId}_{versionPart}.file"
            );

            return await GetFileFromCacheOrDatabase(
                finalCacheFilePath,
                () => Task.FromResult(GetFileResult(file)),
                guildId
            );
        }
        [DisableControllerIfPostgres]
        [HttpGet("profiles/{userId}")]
        public async Task<IActionResult> GetProfileFile(
            [FromRoute] string userId,
            [FromQuery] string? version = null
        )
        {
            userId = userId.Split('?')[0];
            userId = RemoveFileExtension(userId);

            if (userId.Length != 18 || ContainsIllegalPathSegments(userId))
                return BadRequest("Invalid userId.");

            var (cacheFound, cacheFilePath) = await FindCachedProfileFile(userId, version);

            if (cacheFound)
                return await GetFileFromCacheOrDatabase(cacheFilePath, null, userId);

            var file = await _context.ProfileFiles.FirstOrDefaultAsync(f => f.UserId == userId);
            if (file == null)
                return NotFound();

            var versionPart =
                !string.IsNullOrEmpty(version) && version == file.Version ? version : file.Version;
            var finalCacheFilePath = Path.Combine(
                CacheDirectory,
                $"profile_{userId}_{versionPart}.file"
            );

            return await GetFileFromCacheOrDatabase(
                finalCacheFilePath,
                () => Task.FromResult(GetFileResult(file)),
                userId
            );
        }
        [DisableControllerIfPostgres]
        [HttpGet("attachments/{attachmentId}")]
        public async Task<IActionResult> GetAttachmentFile(
            [FromRoute][IdLengthValidation] string attachmentId
        )
        {
            if (ContainsIllegalPathSegments(attachmentId))
                return BadRequest("Invalid attachmentId.");

            var cacheFilePath = Path.Combine(CacheDirectory, $"{attachmentId}.file");

            return await GetFileFromCacheOrDatabase(
                cacheFilePath,
                async () =>
                {
                    var file = await _context.AttachmentFiles.FirstOrDefaultAsync(f =>
                        f.FileId == attachmentId
                    );
                    if (file == null)
                        return NotFound();

                    return GetFileResult(file);
                },
                attachmentId
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

            var cacheFilePath = Path.Combine(CacheDirectory, $"{guildId}_{emojiId}.file");

            return await GetFileFromCacheOrDatabase(
                cacheFilePath,
                async () =>
                {
                    var file = await _context.EmojiFiles.FirstOrDefaultAsync(f =>
                        f.FileId == emojiId && f.GuildId == guildId
                    );
                    if (file == null)
                        return NotFound();

                    return GetFileResult(file, true);
                },
                emojiId
            );
        }



        private bool ContainsIllegalPathSegments(string input)
        {
            if (!input.All(char.IsDigit))
                return false;
            return input.Contains("..") || input.Contains("/") || input.Contains("\\");
        }

        private IActionResult GetFileResult(dynamic file, bool isExtensionManual = false)
        {
            if (file == null)
                return NotFound(new { Error = "File not found." });

            string sanitizedFileName = Utils.SanitizeFileName(file.FileName);
            string contentType = GetContentType(file);

            if (IsVideoContent(contentType))
            {
                var stream = new MemoryStream(file.Content);
                SetCacheHeaders(sanitizedFileName);
                _statsService.IncrementServedFiles();
                return File(stream, contentType, sanitizedFileName, enableRangeProcessing: true);
            }

            SetCacheHeaders(sanitizedFileName);
            _statsService.IncrementServedFiles();
            return File(file.Content, contentType);
        }

        private string GetContentType(dynamic file)
        {
            if (FileTypeValidator.IsArchive(file.Content))
                return GetGzipContentType(file);

            return GetRegularContentType(file);
        }

        private string GetGzipContentType(dynamic file)
        {
            try
            {
                file.Content = FileDecompressor.DecompressGzip(file.Content);
                string originalExt = Path.GetExtension(
                        Path.GetFileNameWithoutExtension(file.FileName)
                    )
                    .ToLowerInvariant();

                return originalExt switch
                {
                    ".json" => "application/json",
                    ".txt" => "text/plain",
                    ".xml" => "application/xml",
                    ".csv" => "text/csv",
                    ".html" => "text/html",
                    _ => "application/octet-stream",
                };
            }
            catch
            {
                return "application/gzip";
            }
        }

        private string GetRegularContentType(dynamic file)
        {
            var ext = Path.GetExtension(file.FileName).TrimStart('.').ToLowerInvariant();
            var mimeType = MimeTypes.GetMimeType(ext);
            return string.IsNullOrEmpty(mimeType) ? "application/octet-stream" : mimeType;
        }

        private void SetCacheHeaders(string fileName)
        {
            Response.Headers.Append("Content-Disposition", $"inline; filename=\"{fileName}\"");
            Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
            Response.Headers["Expires"] = DateTime.UtcNow.AddYears(1).ToString("R");
        }
    }
}
