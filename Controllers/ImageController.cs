using System.Security.Claims;
using LiventCord.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [ApiController]
    [Route("")]
    public class UploadController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly ILogger<UploadController> _logger;

        public UploadController(AppDbContext context, ILogger<UploadController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpPost("/api/upload_img")]
        [Authorize]
        public async Task<IActionResult> UploadImage(IFormFile photo, string? guildId = null)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (photo == null || photo.Length == 0)
                return BadRequest("No file uploaded.");

            var extension = Path.GetExtension(photo.FileName).ToLowerInvariant();
            if (!FileExtensions.IsValidImageExtension(extension))
                return BadRequest("Invalid file type. Only images are allowed.");

            if (!IsValidFileName(photo.FileName))
                return BadRequest("Invalid file name.");

            using var memoryStream = new MemoryStream();
            await photo.CopyToAsync(memoryStream);

            var content = memoryStream.ToArray();
            var fileId = Utils.CreateRandomId();

            if (!string.IsNullOrEmpty(guildId))
            {
                await SaveOrUpdateFile<GuildFile>(
                    photo.FileName,
                    content,
                    extension,
                    guildId,
                    fileId
                );
            }
            else
            {
                await SaveOrUpdateFile<ProfileFile>(
                    photo.FileName,
                    content,
                    extension,
                    userId,
                    fileId
                );
            }

            return Ok(new { fileId });
        }

        private async Task SaveOrUpdateFile<T>(
            string fileName,
            byte[] content,
            string extension,
            string? userId = null,
            string? guildId = null,
            string fileId = ""
        )
            where T : FileBase
        {
            T? existingFile = await GetExistingFile<T>(userId, guildId);

            if (existingFile != null)
            {
                await UpdateFile(existingFile, fileName, content, extension, userId, guildId);
            }
            else
            {
                await CreateNewFile<T>(fileName, content, extension, fileId, userId, guildId);
            }

            await _context.SaveChangesAsync();
        }

        private async Task<T?> GetExistingFile<T>(string? userId, string? guildId)
            where T : FileBase
        {
            if (string.IsNullOrEmpty(userId) && string.IsNullOrEmpty(guildId)) return null;

            return await _context
                .Set<T>()
                .FirstOrDefaultAsync(f => CheckFileMatch(f, userId, guildId));
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

        private async Task CreateNewFile<T>(
            string fileName,
            byte[] content,
            string extension,
            string fileId,
            string? userId,
            string? guildId
        )
            where T : FileBase
        {
            T? newFile = Activator.CreateInstance(
                typeof(T),
                fileId,
                fileName,
                content,
                extension,
                userId,
                guildId
            ) as T;

            if (newFile == null)
            {
                throw new InvalidOperationException(
                    $"Unable to create instance of {typeof(T).Name}."
                );
            }

            SetFileIds(newFile, userId, guildId);

            _logger.LogInformation(
                "Saved new file: {FileId}, {FileName}, {UserId}, {GuildId}, {Extension}",
                fileId,
                fileName,
                userId,
                guildId,
                extension
            );

            await _context.Set<T>().AddAsync(newFile);
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
