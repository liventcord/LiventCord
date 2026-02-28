using System.IO.Compression;
using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MimeKit;

public static class FileDecompressor
{
    public static byte[] DecompressGzip(byte[] compressedData)
    {
        using var input = new MemoryStream(compressedData);
        using var gzip = new GZipStream(input, CompressionMode.Decompress);
        using var output = new MemoryStream();
        gzip.CopyTo(output);
        return output.ToArray();
    }
}


public static class FileCompressor
{
    public static byte[] CompressToGzip(byte[] fileContent)
    {
        using var compressedStream = new MemoryStream();
        using (var gzipStream = new GZipStream(compressedStream, CompressionLevel.Optimal))
        {
            gzipStream.Write(fileContent, 0, fileContent.Length);
        }

        return compressedStream.ToArray();
    }

    public static bool ShouldCompress(string extension)
    {
        return extension switch
        {
            ".txt" or ".html" or ".css" or ".xml" or ".json" or ".csv" or ".log" or ".md" or ".rtf" or
            ".yml" or ".yaml" or ".toml" or ".conf" or ".ini" or ".php" or ".js" or ".ts" or ".java" or
            ".py" or ".rb" or ".go" or ".cpp" or ".h" or ".swift" or ".dart" or ".sql" or ".db" or
            ".bak" or ".tar" or ".psd" or ".ai" => true,
            _ => false
        };
    }
}
namespace LiventCord.Controllers
{
    [ApiController]
    [Route("api/v1/images")]
    [Authorize]
    public class FileController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly PermissionsController _permissionsController;
        private readonly IAppLogger<FileController> _logger;
        private readonly ICacheService _cacheService;
        private readonly IFileCacheService _fileCacheService;

        public FileController(
            AppDbContext context,
            IAppLogger<FileController> logger,
            PermissionsController permissionsController,
            ICacheService cacheService,
            IFileCacheService fileCacheService
        )
        {
            _context = context;
            _logger = logger;
            _permissionsController = permissionsController;
            _cacheService = cacheService;
            _fileCacheService = fileCacheService;
        }

        [HttpPost("profile")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadProfileImage(
            [FromForm] ProfileImageUploadRequest request
        )
        {
            if (!IsFileSizeValid(request.Photo))
                return BadRequest(new { Type = "error", Message = "The file exceeds the maximum size limit." });

            try
            {
                var profileVersion = await UploadFileInternalAsync(request.Photo, UserId!, false, false, null);

                await _fileCacheService.ClearProfileFileCacheAsync(UserId!);
                _cacheService.InvalidateCache(UserId!);

                return Ok(new { profileVersion });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Type = "error", Message = ex.Message });
            }
        }

        [NonAction]
        public async Task<string?> UploadProfileImageFromGoogle(string userId, string googleUrl)
        {
            using var httpClient = new HttpClient();
            _logger.LogInformation($"Downloading google image from {googleUrl}");
            using var imageStream = await httpClient.GetStreamAsync(googleUrl);

            var memoryStream = new MemoryStream();
            await imageStream.CopyToAsync(memoryStream);
            memoryStream.Position = 0;

            _logger.LogInformation($"Downloaded image size: {memoryStream.Length} bytes");

            var formFile = new FormFile(
                memoryStream,
                0,
                memoryStream.Length,
                "file",
                "google-profile.jpg"
            );

            formFile.Headers = new HeaderDictionary();
            formFile.ContentType = "image/jpeg";

            var uploadedImageUrl = await UploadFileInternalAsync(formFile, userId, false, false, null);
            _logger.LogInformation($"Image uploaded successfully. URL: {uploadedImageUrl}");
            _cacheService.InvalidateCache(UserId!);

            return uploadedImageUrl;
        }

        [HttpPost("guild")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadGuildImage([FromForm] GuildImageUploadRequest request)
        {
            if (!await _permissionsController.CanManageGuild(UserId!, request.GuildId))
                return Forbid();

            if (!IsFileSizeValid(request.Photo))
                return BadRequest(new { Type = "error", Message = "The file exceeds the maximum size limit." });

            try
            {
                var extension = Path.GetExtension(request.Photo.FileName).ToLowerInvariant();
                if (string.IsNullOrEmpty(extension) && request.Photo.ContentType.StartsWith("image/"))
                {
                    extension = DetermineImageExtension(request.Photo.ContentType);
                }

                using var memoryStream = new MemoryStream();
                await request.Photo.CopyToAsync(memoryStream);
                var content = memoryStream.ToArray();
                string sanitizedFileName = Utils.SanitizeFileName(request.Photo.FileName);
                if (string.IsNullOrEmpty(Path.GetExtension(sanitizedFileName)))
                    sanitizedFileName += extension;

                if (FileCompressor.ShouldCompress(extension))
                {
                    content = FileCompressor.CompressToGzip(content);
                    sanitizedFileName += ".gz";
                    extension = ".gz";
                }

                var newGuildFile = new GuildFile(
                    Utils.CreateRandomId(),
                    sanitizedFileName,
                    content,
                    extension,
                    request.GuildId,
                    UserId!
                )
                {
                    Version = Guid.NewGuid().ToString(),
                    CreatedAt = DateTime.UtcNow
                };

                await _context.GuildFiles.AddAsync(newGuildFile);
                await _context.SaveChangesAsync();

                await SetIsUploadedGuildImgAsync(request.GuildId);

                await _fileCacheService.ClearGuildFileCacheAsync(request.GuildId);
                _cacheService.InvalidateCache(UserId!);

                return Ok(new { request.GuildId, guildVersion = newGuildFile.Version });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upload guild image.");
                return BadRequest(new { Type = "error", Message = ex.Message });
            }
        }


        [NonAction]
        public async Task<string?> UploadImageOnGuildCreation(
            IFormFile photo,
            string userId,
            string? guildId = null
        )
        {
            if (!IsFileSizeValid(photo))
            {
                return null;
            }

            try
            {
                string fileId = await UploadFileInternalAsync(
                    photo,
                    userId,
                    isAttachment: false,
                    isEmoji: false,
                    guildId: guildId,
                    channelId: null
                );

                if (!string.IsNullOrEmpty(guildId))
                    await SetIsUploadedGuildImgAsync(guildId);

                return fileId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upload image on guild creation for guildId: {GuildId}", guildId);
                return null;
            }
        }

        private bool IsFileSizeValid(IFormFile file)
        {
            return file.Length <= SharedAppConfig.GetMaxAvatarsSize(); ;
        }

        [NonAction]
        public async Task<string> UploadFileInternalAsync(
                  IFormFile file,
                  string userId,
                  bool isAttachment = false,
                  bool isEmoji = false,
                  string? guildId = null,
                  string? channelId = null
              )
        {
            if (string.IsNullOrEmpty(userId))
                throw new UnauthorizedAccessException("User not authorized.");

            if (file == null || file.Length == 0)
                throw new ArgumentException("No file uploaded.");

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (string.IsNullOrEmpty(extension) && file.ContentType.StartsWith("image/"))
            {
                extension = DetermineImageExtension(file.ContentType);
            }

            bool validExtension = FileExtensions.IsValidImageExtension(extension);
            bool isImageFile = file.ContentType.StartsWith("image/");

            if (!isAttachment && (!validExtension || !isImageFile))
                throw new ArgumentException("Invalid file type. Only images are allowed.");

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var content = memoryStream.ToArray();

            if (FileCompressor.ShouldCompress(extension))
            {
                content = FileCompressor.CompressToGzip(content);
                extension += ".gz";
            }

            string sanitizedFileName = Utils.SanitizeFileName(file.FileName);
            if (string.IsNullOrEmpty(Path.GetExtension(sanitizedFileName)))
                sanitizedFileName += extension;

            string contentHash;
            using (var sha = System.Security.Cryptography.SHA256.Create())
            {
                contentHash = Convert.ToHexString(sha.ComputeHash(content));
            }

            FileBase? existingFile = null;
            if (!string.IsNullOrEmpty(guildId))
            {
                existingFile = await _context.Set<FileBase>()
                    .OfType<GuildFile>()
                    .AsNoTracking()
                    .Where(f => f.GuildId == guildId && f.UserId == userId && f.ContentHash == contentHash)
                    .FirstOrDefaultAsync();
            }
            else if (!isAttachment)
            {
                existingFile = await _context.Set<FileBase>()
                    .OfType<ProfileFile>()
                    .AsNoTracking()
                    .Where(f => f.UserId == userId && f.ContentHash == contentHash)
                    .FirstOrDefaultAsync();
            }

            if (existingFile != null)
            {
                return ExtractFileIdentifier(existingFile);
            }

            FileBase savedFile = CreateFileEntity(
                sanitizedFileName,
                content,
                extension,
                userId,
                guildId,
                channelId,
                isEmoji,
                isAttachment,
                contentHash
            );

            return ExtractFileIdentifier(savedFile);
        }
        private string DetermineImageExtension(string contentType)
        {
            return contentType.ToLowerInvariant() switch
            {
                "image/jpeg" => ".jpg",
                "image/png" => ".png",
                "image/gif" => ".gif",
                "image/webp" => ".webp",
                "image/svg+xml" => ".svg",
                "image/bmp" => ".bmp",
                "image/tiff" => ".tiff",
                _ => ""
            };
        }

        private FileBase CreateFileEntity(
            string fileName,
            byte[] content,
            string extension,
            string userId,
            string? guildId,
            string? channelId,
            bool isEmoji,
            bool isAttachment,
            string contentHash
        )
        {
            if (!string.IsNullOrEmpty(guildId))
            {
                if (!string.IsNullOrEmpty(channelId))
                {
                    var attachment = new AttachmentFile(
                        Utils.CreateRandomId(),
                        fileName,
                        content,
                        extension,
                        channelId,
                        guildId,
                        userId
                    )
                    {
                        ContentHash = contentHash
                    };
                    return SaveOrUpdateFile(attachment).GetAwaiter().GetResult();
                }
                else if (isEmoji)
                {
                    var emoji = new EmojiFile(
                        Utils.CreateRandomId(),
                        "emoji-" + Utils.CreateRandomId(),
                        content,
                        extension,
                        guildId,
                        userId
                    )
                    {
                        ContentHash = contentHash
                    };
                    SaveFile(emoji).GetAwaiter().GetResult();
                    return emoji;
                }
                else
                {
                    var guildFile = new GuildFile(
                        Utils.CreateRandomId(),
                        fileName,
                        content,
                        extension,
                        guildId,
                        userId
                    )
                    {
                        ContentHash = contentHash
                    };
                    return SaveOrUpdateFile(guildFile).GetAwaiter().GetResult();
                }
            }
            else
            {
                if (!string.IsNullOrEmpty(channelId))
                {
                    var attachment = new AttachmentFile(
                        Utils.CreateRandomId(),
                        fileName,
                        content,
                        extension,
                        channelId,
                        guildId,
                        userId
                    )
                    {
                        ContentHash = contentHash
                    };
                    return SaveOrUpdateFile(attachment).GetAwaiter().GetResult();
                }
                else
                {
                    var profileFile = new ProfileFile(
                        Utils.CreateRandomId(),
                        fileName,
                        content,
                        extension,
                        userId
                    )
                    {
                        ContentHash = contentHash
                    };
                    return SaveOrUpdateFile(profileFile).GetAwaiter().GetResult();
                }
            }
        }
        private string ExtractFileIdentifier(FileBase file)
        {
            return file switch
            {
                ProfileFile pf => pf.Version,
                GuildFile gf => gf.Version,
                _ => file.FileId
            };
        }

        [NonAction]
        public void DeleteAttachmentFilesAsync(List<Message> messages)
        {
            if (messages == null || !messages.Any())
                return;

            var attachmentIds = messages
                .Where(m => m.Attachments != null)
                .SelectMany(m => m.Attachments!)
                .Where(a => !string.IsNullOrEmpty(a.FileId))
                .Select(a => a.FileId)
                .Distinct();

            foreach (var fileId in attachmentIds)
                _fileCacheService.ClearAttachmentFileCache(fileId);
        }

        [NonAction]
        public void DeleteAttachmentFileAsync(Message message)
        {
            if (message?.Attachments == null || !message.Attachments.Any())
                return;

            var attachmentIds = message.Attachments
                .Where(a => !string.IsNullOrEmpty(a.FileId))
                .Select(a => a.FileId)
                .Distinct();

            foreach (var fileId in attachmentIds)
                _fileCacheService.ClearAttachmentFileCache(fileId);
        }

        private async Task SetIsUploadedGuildImgAsync(string guildId)
        {
            var guild = await _context
                .Guilds.Where(g => g.GuildId == guildId)
                .FirstOrDefaultAsync();

            if (guild != null)
            {
                guild.IsGuildUploadedImg = true;

                await _context.SaveChangesAsync();
            }
        }

        private async Task SaveFile<T>(T newFile)
            where T : FileBase
        {
            await _context.Set<T>().AddAsync(newFile);

            _logger.LogInformation(
                "Added new file: {FileId}, Content Length: {ContentLength}",
                newFile.FileId,
                newFile.Content.Length
            );

            await _context.SaveChangesAsync();
        }

        private async Task<T> SaveOrUpdateFile<T>(T newFile)
            where T : FileBase
        {
            var existingFile = await GetExistingFile(newFile);

            if (existingFile != null)
            {
                if (existingFile is ProfileFile profileExisting && newFile is ProfileFile profileNew)
                {
                    var newVersionFile = new ProfileFile(
                        Utils.CreateRandomId(),
                        profileNew.FileName!,
                        profileNew.Content,
                        profileNew.Extension,
                        profileExisting.UserId
                    )
                    {
                        Version = Guid.NewGuid().ToString()
                    };

                    await _context.Set<ProfileFile>().AddAsync(newVersionFile);
                    await _context.SaveChangesAsync();

                    return (T)(FileBase)newVersionFile;
                }
                else if (existingFile is GuildFile guildExisting && newFile is GuildFile guildNew)
                {
                    var newVersionFile = new GuildFile(
                        Utils.CreateRandomId(),
                        guildNew.FileName!,
                        guildNew.Content,
                        guildNew.Extension,
                        guildExisting.GuildId,
                        guildExisting.UserId
                    )
                    {
                        Version = Guid.NewGuid().ToString()
                    };

                    await _context.Set<GuildFile>().AddAsync(newVersionFile);
                    await _context.SaveChangesAsync();

                    return (T)(FileBase)newVersionFile;
                }
                else
                {
                    throw new InvalidOperationException(
                        $"Unsupported type combination: {existingFile.GetType()} / {newFile.GetType()}"
                    );
                }
            }
            else
            {
                if (newFile is ProfileFile profile)
                {
                    profile.Version = Guid.NewGuid().ToString();
                }
                else if (newFile is GuildFile guild)
                {
                    guild.Version = Guid.NewGuid().ToString();
                }

                await _context.Set<T>().AddAsync(newFile);
                await _context.SaveChangesAsync();

                return newFile;
            }
        }

        private async Task<T?> GetExistingFile<T>(T newFile)
            where T : FileBase
        {
            string? userId =
                (newFile as ProfileFile)?.UserId
                ?? (newFile as GuildFile)?.UserId
                ?? (newFile as AttachmentFile)?.UserId;

            string? guildId = newFile.GuildId;
            string? fileId = newFile.FileId;

            var query = _context.Set<T>().AsQueryable();

            if (typeof(T) == typeof(ProfileFile))
            {
                query = query.Where(file => ((ProfileFile)(object)file).UserId == userId);
            }
            else if (typeof(T) == typeof(GuildFile))
            {
                query = query.Where(file =>
                    ((GuildFile)(object)file).UserId == userId
                    && ((GuildFile)(object)file).GuildId == guildId
                );
            }
            else if (typeof(T) == typeof(AttachmentFile))
            {
                query = query.Where(file =>
                    ((AttachmentFile)(object)file).UserId == userId
                    && ((AttachmentFile)(object)file).GuildId == guildId
                    && ((AttachmentFile)(object)file).FileId == fileId
                );
            }

            return await query.FirstOrDefaultAsync();
        }
    }
}

public static class FileSignatureValidator
{
    public static bool IsImageFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return false;
        }

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(extension))
        {
            return false;
        }

        if (!extension.StartsWith("."))
        {
            extension = "." + extension;
        }

        var validImageExtensions = new[]
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".webp",
            ".svg",
            ".bmp",
            ".tiff",
        };

        if (!validImageExtensions.Contains(extension.ToLowerInvariant()))
        {
            return false;
        }

        var contentType = file.ContentType;

        var validImageContentTypes = new[]
        {
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml",
            "image/bmp",
            "image/tiff",
        };

        if (
            validImageContentTypes.Any(ct =>
                contentType.StartsWith(ct, StringComparison.OrdinalIgnoreCase)
            )
        )
        {
            return true;
        }

        var detectedMimeType = MimeTypes.GetMimeType(extension);
        if (
            !string.IsNullOrEmpty(detectedMimeType)
            && detectedMimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)
        )
        {
            return true;
        }

        return false;
    }

    public static bool IsVideoFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return false;
        }

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(extension))
        {
            return false;
        }

        if (!extension.StartsWith("."))
        {
            extension = "." + extension;
        }

        var validVideoExtensions = new[]
        {
            ".mp4",
            ".avi",
            ".mkv",
            ".mov",
            ".wmv",
            ".flv",
            ".webm",
            ".mpeg",
        };

        if (!validVideoExtensions.Contains(extension.ToLowerInvariant()))
        {
            return false;
        }

        var contentType = file.ContentType;

        var validVideoContentTypes = new[]
        {
            "video/mp4",
            "video/x-msvideo",
            "video/x-matroska",
            "video/quicktime",
            "video/x-ms-wmv",
            "video/x-flv",
            "video/webm",
            "video/mpeg",
        };

        if (
            validVideoContentTypes.Any(ct =>
                contentType.StartsWith(ct, StringComparison.OrdinalIgnoreCase)
            )
        )
        {
            return true;
        }

        return false;
    }
}

public class ProfileImageUploadRequest
{
    public required IFormFile Photo { get; set; }
}

public class GuildImageUploadRequest
{
    public required IFormFile Photo { get; set; }

    [IdLengthValidation]
    public required string GuildId { get; set; }
}

public class GuildEmojiUploadRequest
{
    public required List<IFormFile> Photos { get; set; }

    [IdLengthValidation]
    public required string GuildId { get; set; }
}
