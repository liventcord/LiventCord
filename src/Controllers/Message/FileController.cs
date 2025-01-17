using System.Drawing;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [ApiController]
    [Route("")]
    public class FileController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly FileExtensionContentTypeProvider _fileTypeProvider;
        private readonly IWebHostEnvironment _env;

        public FileController(
            AppDbContext context,
            FileExtensionContentTypeProvider fileTypeProvider,
            IWebHostEnvironment env
        )
        {
            _context = context;
            _fileTypeProvider = fileTypeProvider ?? new FileExtensionContentTypeProvider();
            _env = env;
        }

        [HttpGet("guilds/{guildId}")]
        public async Task<IActionResult> GetGuildFile(string guildId)
        {
            guildId = RemoveFileExtension(guildId);

            var file = await _context.GuildFiles.FirstOrDefaultAsync(f => f.GuildId == guildId);
            if (file == null)
                return NotFound(new { Error = "Guild file not found." });

            return GetFileResult(file);
        }

        [HttpGet("profiles/{userId}")]
        public async Task<IActionResult> GetProfileFile(string userId)
        {
            userId = RemoveFileExtension(userId);

            var file = await _context.ProfileFiles.FirstOrDefaultAsync(f => f.UserId == userId);
            if (file == null)
                return NotFound(new { Error = "Profile file not found." });

            return GetFileResult(file);
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

        private IActionResult GetFileResult(dynamic file)
        {
            if (file == null)
                return NotFound(new { Error = "File not found." });

            if (!_fileTypeProvider.TryGetContentType(file.FileName, out string contentType))
                contentType = "application/octet-stream";

            Response.Headers.Append("Content-Disposition", $"inline; filename=\"{file.FileName}\"");
            return File(file.Content, contentType);
        }

        [HttpGet("/api/list_files")]
        public async Task<IActionResult> ListFiles()
        {
            if (!_env.IsDevelopment())
            {
                return NotFound();
            }

            var profileFiles = await _context.ProfileFiles.ToListAsync();
            var attachmentFiles = await _context.AttachmentFiles.ToListAsync();
            var emojiFiles = await _context.EmojiFiles.ToListAsync();
            var guildFiles = await _context.GuildFiles.ToListAsync();

            var allFiles = profileFiles
                .Cast<FileBase>()
                .Concat(attachmentFiles.Cast<FileBase>())
                .Concat(emojiFiles.Cast<FileBase>())
                .Concat(guildFiles.Cast<FileBase>())
                .Select(f => new
                {
                    f.FileId,
                    f.FileName,
                    FileSize = f.Content.Length,
                    f.Extension,
                    f.GuildId,
                    UserId = (f is GuildFile || f is AttachmentFile || f is ProfileFile)
                        ? ((dynamic)f).UserId
                        : null,
                    MessageId = (f is AttachmentFile attachmentFile)
                        ? attachmentFile.MessageId
                        : null,
                })
                .ToList();

            var html = "<html><body style=\"background-color:black\">";

            foreach (var file in allFiles)
            {
                var fileUrl =
                    Url.Action("GetProfileFile", "File", new { userId = file.UserId }) ?? "";

                if (
                    file.Extension == ".jpg"
                    || file.Extension == ".png"
                    || file.Extension == ".jpeg"
                    || file.Extension == ".gif"
                )
                {
                    html +=
                        $"<div><h3>{file.FileName}</h3><img src={fileUrl} alt={file.FileName} width=200 /></div>";
                }
                else
                {
                    html +=
                        $"<div><h3>{file.FileName}</h3><p>File size: {file.FileSize} bytes</p></div>";
                }
            }

            html += "</body></html>";

            return Content(html, "text/html");
        }
    }
}
