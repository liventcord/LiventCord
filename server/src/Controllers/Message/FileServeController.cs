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

        public FileServeController(
            AppDbContext context,
            FileExtensionContentTypeProvider fileTypeProvider,
            IWebHostEnvironment env,
            PermissionsController permissionsController
        )
        {
            _context = context;
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
        private async Task<IActionResult> GetFileFromCacheOrDatabase(string cacheFilePath, Func<Task<IActionResult>> fetchFile)
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
                var fileBytes = await System.IO.File.ReadAllBytesAsync(fullRequestedPath);
                var contentType = await System.IO.File.ReadAllTextAsync(metaPath);
                return File(fileBytes, contentType);
            }

            var result = await fetchFile();

            if (result is FileContentResult fileResult)
            {
                var path = Path.GetDirectoryName(fullRequestedPath);
                if (path != null)
                {
                    Directory.CreateDirectory(path);
                    await System.IO.File.WriteAllBytesAsync(fullRequestedPath, fileResult.FileContents);
                    await System.IO.File.WriteAllTextAsync(metaPath, fileResult.ContentType ?? "application/octet-stream");
                }
            }

            return result;
        }

        [HttpGet("guilds/{guildId}")]
        public async Task<IActionResult> GetGuildFile([FromRoute][IdLengthValidation] string guildId)
        {
            guildId = RemoveFileExtension(guildId);

            if (string.IsNullOrEmpty(guildId) || ContainsIllegalPathSegments(guildId))
            {
                return BadRequest("Invalid guildId.");
            }

            var cacheFilePath = Path.Combine(CacheDirectory, $"{guildId}.file");

            return await GetFileFromCacheOrDatabase(cacheFilePath, async () =>
            {
                var file = await _context.GuildFiles.FirstOrDefaultAsync(f => f.GuildId == guildId);
                if (file == null)
                    return NotFound();

                return GetFileResult(file);
            });
        }

        [HttpGet("profiles/{userId}")]
        public async Task<IActionResult> GetProfileFile([FromRoute] string userId)
        {
            userId = userId.Split('?')[0];
            userId = RemoveFileExtension(userId);

            if (userId.Length != 18 || ContainsIllegalPathSegments(userId))
            {
                return BadRequest("Invalid userId.");
            }

            var cacheFilePath = Path.Combine(CacheDirectory, $"{userId}.file");

            return await GetFileFromCacheOrDatabase(cacheFilePath, async () =>
            {
                var file = await _context.ProfileFiles.FirstOrDefaultAsync(f => f.UserId == userId);
                if (file == null)
                    return NotFound();

                return GetFileResult(file);
            });
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
            });
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
            });
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

            string contentType;
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

            if (extension == ".gz")
            {
                contentType = "application/gzip";
            }
            else
            {
                if (isExtensionManual)
                {
                    switch (extension)
                    {
                        case ".jpg":
                        case ".jpeg":
                            contentType = "image/jpeg";
                            break;
                        case ".png":
                            contentType = "image/png";
                            break;
                        case ".gif":
                            contentType = "image/gif";
                            break;
                        case ".svg":
                            contentType = "image/svg+xml";
                            break;
                        default:
                            contentType = "application/octet-stream";
                            break;
                    }
                }
                else
                {
                    if (!_fileTypeProvider.TryGetContentType(file.FileName, out string? detectedType))
                        contentType = "application/octet-stream";
                    else
                        contentType = detectedType!;
                }
            }

            var sanitizedFileName = Utils.SanitizeFileName(file.FileName);
            Response.Headers.Append("Content-Disposition", $"inline; filename=\"{sanitizedFileName}\"");
            Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
            Response.Headers["Expires"] = DateTime.UtcNow.AddYears(1).ToString("R");

            return File(file.Content, contentType);
        }
    }
}