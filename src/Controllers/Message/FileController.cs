using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using LiventCord.Helpers;
using System.Security.Cryptography;
using System.Text;

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

            var sanitizedFileName = Utils.SanitizeFileName(file.FileName);
            Response.Headers.Append("Content-Disposition", $"inline; filename=\"{sanitizedFileName}\"");

            Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
            Response.Headers["Expires"] = DateTime.UtcNow.AddYears(1).ToString("R");

            return File(file.Content, contentType);
        }


    }




}





