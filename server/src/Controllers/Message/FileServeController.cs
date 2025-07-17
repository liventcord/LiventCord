using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using LiventCord.Helpers;

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
        private string CacheDirectory => Path.Combine(Directory.GetCurrentDirectory(), _cacheFilePath);
        private readonly IAppStatsService _statsService;

        public FileServeController(
            AppDbContext context,
            FileExtensionContentTypeProvider fileTypeProvider,
            IWebHostEnvironment env,
            PermissionsController permissionsController,
            IAppStatsService statsService
        )
        {
            _context = context;
            _statsService = statsService;
            _fileTypeProvider = fileTypeProvider ?? new FileExtensionContentTypeProvider();
            _env = env;
            _permissionsController = permissionsController;

            var fullCachePath = Path.Combine(Directory.GetCurrentDirectory(), _cacheFilePath);
            if (!Directory.Exists(fullCachePath))
            {
                Directory.CreateDirectory(fullCachePath);
            }
        }

        private string RemoveFileExtension(string userId)
        {
            var extensionIndex = userId.LastIndexOf(".");
            if (extensionIndex > 0)
            {
                userId = userId.Substring(0, extensionIndex);
            }
            return userId;
        }
        private async Task<IActionResult> GetFileFromCacheOrDatabase(string cacheFilePath, Func<Task<IActionResult>> fetchFile, string fileName)
        {
            var fullCacheDirPath = Path.GetFullPath(CacheDirectory);
            var fullRequestedPath = Path.GetFullPath(cacheFilePath);

            if (!Path.GetRelativePath(fullCacheDirPath, fullRequestedPath).StartsWith(".") &&
                !fullRequestedPath.StartsWith(fullCacheDirPath, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("Invalid file path.");
            }

            var metaPath = fullRequestedPath + ".meta";

            if (System.IO.File.Exists(fullRequestedPath) && System.IO.File.Exists(metaPath))
            {
                byte[] fileBytes;
                using (var fs = new FileStream(fullRequestedPath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    fileBytes = new byte[fs.Length];
                    await fs.ReadAsync(fileBytes, 0, (int)fs.Length);
                }
                var contentType = await System.IO.File.ReadAllTextAsync(metaPath);
                SetCacheHeaders(fileName);
                _statsService.IncrementServedFiles();
                return File(fileBytes, contentType);
            }

            var result = await fetchFile();

            if (result is FileContentResult fileResult)
            {
                var path = Path.GetDirectoryName(fullRequestedPath);
                if (path != null)
                {
                    Directory.CreateDirectory(path);

                    var tempFile = fullRequestedPath + ".tmp";
                    var tempMeta = metaPath + ".tmp";

                    await System.IO.File.WriteAllBytesAsync(tempFile, fileResult.FileContents);
                    await System.IO.File.WriteAllTextAsync(tempMeta, fileResult.ContentType ?? "application/octet-stream");

                    System.IO.File.Move(tempFile, fullRequestedPath, overwrite: true);
                    System.IO.File.Move(tempMeta, metaPath, overwrite: true);
                }
            }

            return result;
        }

        [HttpGet("guilds/{guildId}")]
        public async Task<IActionResult> GetGuildFile([FromRoute] string guildId, [FromQuery] string? version = null)
        {
            guildId = RemoveFileExtension(guildId);

            if (string.IsNullOrEmpty(guildId) || guildId.Length != 19 || ContainsIllegalPathSegments(guildId))
            {
                return BadRequest("Invalid guildId.");
            }

            var file = await _context.GuildFiles.FirstOrDefaultAsync(f => f.GuildId == guildId);
            if (file == null)
                return NotFound();

            var versionPart = !string.IsNullOrEmpty(version) && version == file.Version ? version : file.Version;

            var cacheFilePath = Path.Combine(CacheDirectory, $"guild_{guildId}_{versionPart}.file");
            return await GetFileFromCacheOrDatabase(cacheFilePath, () =>
            {
                return Task.FromResult(GetFileResult(file));
            }, guildId);
        }

        [HttpGet("profiles/{userId}")]
        public async Task<IActionResult> GetProfileFile([FromRoute] string userId, [FromQuery] string? version = null)
        {
            userId = userId.Split('?')[0];
            userId = RemoveFileExtension(userId);

            if (userId.Length != 18 || ContainsIllegalPathSegments(userId))
            {
                return BadRequest("Invalid userId.");
            }

            var file = await _context.ProfileFiles.FirstOrDefaultAsync(f => f.UserId == userId);
            if (file == null)
                return NotFound();

            var versionPart = !string.IsNullOrEmpty(version) && version == file.Version ? version : file.Version;

            var cacheFilePath = Path.Combine(CacheDirectory, $"profile_{userId}_{versionPart}.file");

            return await GetFileFromCacheOrDatabase(cacheFilePath, () =>
            {
                return Task.FromResult(GetFileResult(file));
            }, userId);
        }

        [HttpGet("attachments/{attachmentId}")]
        public async Task<IActionResult> GetAttachmentFile([FromRoute][IdLengthValidation] string attachmentId)
        {
            if (ContainsIllegalPathSegments(attachmentId))
            {
                return BadRequest("Invalid attachmentId.");
            }

            var cacheFilePath = Path.Combine(CacheDirectory, $"{attachmentId}.file");

            return await GetFileFromCacheOrDatabase(cacheFilePath, async () =>
            {
                var file = await _context.AttachmentFiles.FirstOrDefaultAsync(f => f.FileId == attachmentId);
                if (file == null)
                {
                    return NotFound();
                }

                return GetFileResult(file);
            }, attachmentId);
        }

        [HttpGet("guilds/{guildId}/emojis/{emojiId}")]
        public async Task<IActionResult> GetEmojiFile([FromRoute][IdLengthValidation] string guildId, [FromRoute][IdLengthValidation] string emojiId)
        {
            if (ContainsIllegalPathSegments(guildId) || ContainsIllegalPathSegments(emojiId))
            {
                return BadRequest("Invalid input.");
            }

            var cacheFilePath = Path.Combine(CacheDirectory, $"{guildId}_{emojiId}.file");

            return await GetFileFromCacheOrDatabase(cacheFilePath, async () =>
            {
                var file = await _context.EmojiFiles.FirstOrDefaultAsync(f => f.FileId == emojiId && f.GuildId == guildId);
                if (file == null)
                {
                    return NotFound();
                }

                return GetFileResult(file, true);
            }, emojiId);
        }

        private bool ContainsIllegalPathSegments(string input)
        {
            if (!input.All(char.IsDigit))
            {
                return false;
            }
            return input.Contains("..") || input.Contains("/") || input.Contains("\\");
        }

        private IActionResult GetFileResult(dynamic file, bool isExtensionManual = false)
        {
            if (file == null)
                return NotFound(new { Error = "File not found." });

            string contentType = DetermineContentType(file.FileName, isExtensionManual);
            string sanitizedFileName = Utils.SanitizeFileName(file.FileName);

            SetCacheHeaders(sanitizedFileName);
            _statsService.IncrementServedFiles();
            return File(file.Content, contentType);
        }

        private string DetermineContentType(string fileName, bool isExtensionManual)
        {
            var extension = Path.GetExtension(fileName).ToLowerInvariant();

            if (extension == ".gz")
                return "application/gzip";

            if (isExtensionManual)
            {
                return extension switch
                {
                    ".jpg" or ".jpeg" => "image/jpeg",
                    ".png" => "image/png",
                    ".gif" => "image/gif",
                    ".svg" => "image/svg+xml",
                    _ => "application/octet-stream"
                };
            }

            return _fileTypeProvider.TryGetContentType(fileName, out var detectedType)
                ? detectedType!
                : "application/octet-stream";
        }

        private void SetCacheHeaders(string fileName)
        {
            Response.Headers.Append("Content-Disposition", $"inline; filename=\"{fileName}\"");
            Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
            Response.Headers["Expires"] = DateTime.UtcNow.AddYears(1).ToString("R");
        }
    }

}