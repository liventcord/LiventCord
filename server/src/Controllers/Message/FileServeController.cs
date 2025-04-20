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
        }

        [HttpGet("guilds/{guildId}")]
        public async Task<IActionResult> GetGuildFile([FromRoute][IdLengthValidation] string guildId)
        {
            guildId = RemoveFileExtension(guildId);

            var file = await _context.GuildFiles.FirstOrDefaultAsync(f => f.GuildId == guildId);
            if (file == null)
                return NotFound();

            return GetFileResult(file);
        }

        [HttpGet("profiles/{userId}")]
        public async Task<IActionResult> GetProfileFile([FromRoute] string userId)
        {
            userId = userId.Split('?')[0];
            userId = RemoveFileExtension(userId);
            if (userId.Length != 18)
            {
                return BadRequest("Invalid userId length.");
            }

            var file = await _context.ProfileFiles.FirstOrDefaultAsync(f => f.UserId == userId);
            if (file == null)
                return NotFound();

            return GetFileResult(file);
        }

        [HttpGet("attachments/{attachmentId}")]
        public async Task<IActionResult> GetAttachmentFile([FromRoute][IdLengthValidation] string attachmentId)
        {
            var file = await _context.AttachmentFiles.FirstOrDefaultAsync(f => f.FileId == attachmentId);
            if (file == null)
            {
                return NotFound();
            }

            return GetFileResult(file);
        }

        [HttpGet("guilds/{guildId}/emojis/{emojiId}")]
        public async Task<IActionResult> GetEmojiFile([FromRoute][IdLengthValidation] string guildId, [FromRoute][IdLengthValidation] string emojiId)
        {
            var file = await _context.EmojiFiles.FirstOrDefaultAsync(f => f.FileId == emojiId && f.GuildId == guildId);
            if (file == null)
            {
                return NotFound(_context.EmojiFiles);
            }

            return GetFileResult(file, true);
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

        private IActionResult GetFileResult(dynamic file, bool isExtensionManual = false)
        {
            if (file == null)
                return NotFound(new { Error = "File not found." });

            string contentType;

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

            string[] archiveExtensions = [".tar.gz", ".tgz", ".gz", ".zip", ".rar", ".7z"];

            if (extension == ".gz")
            {
                string originalFileName = Path.GetFileNameWithoutExtension(file.FileName);
                string originalExtension = Path.GetExtension(originalFileName).ToLowerInvariant();

                if (!archiveExtensions.Contains($".{originalExtension.TrimStart('.')}") && originalExtension != ".tar")
                {
                    try
                    {
                        file.Content = FileDecompressor.DecompressGzip(file.Content);
                        file.FileName = originalFileName;

                        if (!_fileTypeProvider.TryGetContentType(originalFileName, out contentType))
                            contentType = "application/octet-stream";
                    }
                    catch
                    {
                        return BadRequest(new { Error = "Failed to decompress file." });
                    }
                }
                else
                {
                    contentType = "application/gzip";
                }
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
                    if (!_fileTypeProvider.TryGetContentType(file.FileName, out contentType))
                        contentType = "application/octet-stream";
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