using System.Security.Claims;
using LiventCord.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
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
            string? additionalField = null,
            string fileId = ""
        )
            where T : FileBase
        {
            T? existingFile = null;

            if (typeof(T) == typeof(ProfileFile) && !string.IsNullOrEmpty(additionalField))
            {
                existingFile = await _context
                    .Set<T>()
                    .FirstOrDefaultAsync(f => ((ProfileFile)(object)f).UserId == additionalField);
            }
            else if (typeof(T) == typeof(GuildFile) && !string.IsNullOrEmpty(additionalField))
            {
                existingFile = await _context
                    .Set<T>()
                    .FirstOrDefaultAsync(f => ((GuildFile)(object)f).GuildId == additionalField);
            }
            else if (typeof(T) == typeof(EmojiFile) && !string.IsNullOrEmpty(additionalField))
            {
                existingFile = await _context
                    .Set<T>()
                    .FirstOrDefaultAsync(f => ((EmojiFile)(object)f).GuildId == additionalField);
            }
            else if (typeof(T) == typeof(AttachmentFile) && !string.IsNullOrEmpty(additionalField))
            {
                existingFile = await _context
                    .Set<T>()
                    .FirstOrDefaultAsync(f =>
                        ((AttachmentFile)(object)f).GuildId == additionalField
                    );
            }

            if (existingFile != null)
            {
                existingFile.FileName = fileName;
                existingFile.Content = content;
                existingFile.Extension = extension;

                if (existingFile is ProfileFile profileFile)
                {
                    profileFile.UserId = additionalField;
                }
                else if (existingFile is GuildFile guildFile)
                {
                    guildFile.GuildId = additionalField;
                    guildFile.UserId = additionalField;
                }
                else if (existingFile is EmojiFile emojiFile)
                {
                    emojiFile.GuildId = additionalField;
                }
                else if (existingFile is AttachmentFile attachmentFile)
                {
                    attachmentFile.GuildId = additionalField;
                    attachmentFile.UserId = additionalField;
                }

                _logger.LogInformation(
                    "Updated file: {FileId}, {FileName}, {AdditionalField}, {Extension}",
                    existingFile.FileId,
                    fileName,
                    additionalField,
                    extension
                );
            }
            else
            {
                T? newFile =
                    Activator.CreateInstance(
                        typeof(T),
                        fileId,
                        fileName,
                        content,
                        extension,
                        additionalField
                    ) as T;

                if (newFile == null)
                    throw new InvalidOperationException(
                        $"Unable to create instance of {typeof(T).Name}."
                    );

                if (newFile is ProfileFile profileFile)
                {
                    profileFile.UserId = additionalField;
                }
                else if (newFile is GuildFile guildFile)
                {
                    guildFile.GuildId = additionalField;
                    guildFile.UserId = additionalField;
                }
                else if (newFile is EmojiFile emojiFile)
                {
                    emojiFile.GuildId = additionalField;
                }
                else if (newFile is AttachmentFile attachmentFile)
                {
                    attachmentFile.GuildId = additionalField;
                    attachmentFile.UserId = additionalField;
                }

                _logger.LogInformation(
                    "Saved new file: {FileId}, {FileName}, {AdditionalField}, {Extension}",
                    fileId,
                    fileName,
                    additionalField,
                    extension
                );
                _context.Set<T>().Add(newFile);
            }

            await _context.SaveChangesAsync();
        }

        private bool IsValidFileName(string fileName)
        {
            return !string.IsNullOrEmpty(fileName)
                && Path.GetInvalidFileNameChars().All(c => !fileName.Contains(c));
        }
    }

    [ApiController]
    [Route("")]
    public class FileController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly FileExtensionContentTypeProvider _fileTypeProvider;

        public FileController(
            AppDbContext context,
            FileExtensionContentTypeProvider fileTypeProvider
        )
        {
            _context = context;
            _fileTypeProvider = fileTypeProvider ?? new FileExtensionContentTypeProvider();
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
                    FileId = f.FileId,
                    FileName = f.FileName,
                    FileSize = f.Content.Length,
                    Extension = f.Extension,
                    GuildId = f.GuildId,
                    ChannelId = (f is GuildFile guildFile) ? guildFile.ChannelId : null,
                    UserId = (f is GuildFile || f is AttachmentFile || f is ProfileFile)
                        ? ((dynamic)f).UserId
                        : null,
                    MessageId = (f is AttachmentFile attachmentFile)
                        ? attachmentFile.MessageId
                        : null,
                })
                .ToList();

            var html = "<html><body>";

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
