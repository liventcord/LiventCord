using LiventCord.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;


namespace LiventCord.Controllers
{
    [ApiController]
    [Route("api")]
    public class ImageController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly ILogger<ImageController> _logger;

        public ImageController(AppDbContext context, ILogger<ImageController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpPost("images/profile")]
        [Authorize]
        public async Task<IActionResult> UploadProfileImage(
            [FromForm] IFormFile photo
        )
        {
            return await UploadImage(photo, UserId!, null);
        }

        [HttpPost("images/guild")]
        [Authorize]
        public async Task<IActionResult> UploadGuildImage(
            [FromForm] IFormFile photo,
            [FromForm][IdLengthValidation] string guildId
        )
        {
            return await UploadImage(photo, UserId!, guildId);
        }

        [NonAction]
        public async Task<IActionResult> UploadImage(
            IFormFile photo,
            string userId,
            string? guildId = null
        )
        {
            if (photo == null || photo.Length == 0)
                return BadRequest("No file uploaded.");

            var extension = Path.GetExtension(photo.FileName).ToLowerInvariant();
            if (
                !FileExtensions.IsValidImageExtension(extension)
                || !photo.ContentType.StartsWith("image/")
            )
                return BadRequest("Invalid file type. Only images are allowed.");

            if (!IsValidFileName(photo.FileName))
                return BadRequest("Invalid file name.");

            string sanitizedFileName = Utils.SanitizeFileName(photo.FileName);

            using var memoryStream = new MemoryStream();
            await photo.CopyToAsync(memoryStream);
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("UserId is null for this request");
                return Unauthorized("User not authorized.");
            }

            var content = memoryStream.ToArray();
            var fileId = Utils.CreateRandomId();

            if (!string.IsNullOrEmpty(guildId))
            {
                await SaveOrUpdateFile(
                    new GuildFile(fileId, sanitizedFileName, content, extension, guildId, userId)
                );
            }
            else
            {
                await SaveOrUpdateFile(
                    new ProfileFile(fileId, sanitizedFileName, content, extension, userId)
                );
            }

            return Ok(new { fileId });
        }


        private async Task SaveOrUpdateFile<T>(T newFile)
            where T : FileBase
        {
            var existingFile = await GetExistingFile<T>(newFile);

            if (existingFile != null)
            {
                existingFile.FileName = newFile.FileName;
                existingFile.Content = newFile.Content;
                existingFile.Extension = newFile.Extension;
            }
            else
            {
                await _context.Set<T>().AddAsync(newFile);
            }

            await _context.SaveChangesAsync();
        }

        private async Task<T?> GetExistingFile<T>(T newFile)
            where T : FileBase
        {
            string? userId = (newFile as ProfileFile)?.UserId ?? (newFile as GuildFile)?.UserId;
            string? guildId = newFile.GuildId;

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

            return await query.FirstOrDefaultAsync();
        }

        private bool CheckFileMatch<T>(T file, string? userId, string? guildId)
            where T : FileBase
        {
            switch (file)
            {
                case ProfileFile profileFile:
                    return profileFile.UserId == userId;
                case GuildFile guildFile:
                    return guildFile.GuildId == guildId;
                case EmojiFile emojiFile:
                    return emojiFile.GuildId == guildId;
                case AttachmentFile attachmentFile:
                    return attachmentFile.GuildId == guildId;
                default:
                    return false;
            }
        }

        private async Task UpdateFile<T>(
            T existingFile,
            string fileName,
            byte[] content,
            string extension,
            string? userId,
            string? guildId
        )
            where T : FileBase
        {
            existingFile.FileName = fileName;
            existingFile.Content = content;
            existingFile.Extension = extension;

            SetFileIds(existingFile, userId, guildId);

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Updated file: {FileId}, {FileName}, {UserId}, {GuildId}, {Extension}",
                existingFile.FileId,
                fileName,
                userId,
                guildId,
                extension
            );
        }

        private T CreateFile<T>(
            string fileId,
            string fileName,
            byte[] content,
            string extension,
            string? userId = null,
            string? guildId = null,
            string? channelId = null,
            string? messageId = null
        )
            where T : FileBase
        {
            if (typeof(T) == typeof(ProfileFile))
            {
                if (userId == null)
                    throw new ArgumentNullException(nameof(userId));
                return (T)(object)new ProfileFile(fileId, fileName, content, extension, userId);
            }

            if (typeof(T) == typeof(GuildFile))
            {
                if (userId == null)
                    throw new ArgumentNullException(nameof(userId));
                return (T)
                    (object)
                        new GuildFile(fileId, fileName, content, extension, guildId, userId)
                        {
                            UserId = userId,
                        };
            }

            if (typeof(T) == typeof(AttachmentFile))
            {
                if (channelId == null || userId == null || messageId == null)
                    throw new ArgumentNullException(
                        $"ChannelId, UserId, and MessageId are required for {nameof(AttachmentFile)}."
                    );
                return (T)
                    (object)
                        new AttachmentFile(
                            fileId,
                            fileName,
                            content,
                            extension,
                            channelId,
                            userId,
                            messageId
                        );
            }

            if (typeof(T) == typeof(EmojiFile))
            {
                return (T)(object)new EmojiFile(fileId, fileName, content, extension, guildId);
            }

            throw new InvalidOperationException($"Unknown file type: {typeof(T).Name}");
        }

        private void SetFileIds<T>(T file, string? userId, string? guildId)
            where T : FileBase
        {
            switch (file)
            {
                case ProfileFile profileFile when userId != null:
                    profileFile.UserId = userId;
                    break;

                case GuildFile guildFile when userId != null && guildId != null:
                    guildFile.UserId = userId;
                    guildFile.GuildId = guildId;
                    break;

                case EmojiFile emojiFile when guildId != null:
                    emojiFile.GuildId = guildId;
                    break;

                case AttachmentFile attachmentFile when userId != null && guildId != null:
                    attachmentFile.UserId = userId;
                    attachmentFile.GuildId = guildId;
                    break;
            }
        }

        private bool IsValidFileName(string fileName)
        {
            return !string.IsNullOrEmpty(fileName)
                && Path.GetInvalidFileNameChars().All(c => !fileName.Contains(c));
        }
    }
}
