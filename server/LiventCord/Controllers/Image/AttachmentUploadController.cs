using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LiventCord.Controllers
{
    [ApiController]
    [Route("api/v1/attachments")]
    [Authorize]
    public class AttachmentUploadController : BaseController
    {
        private readonly FileController _fileController;
        private readonly AppDbContext _context;

        public AttachmentUploadController(AppDbContext context, FileController fileController)
        {
            _context = context;
            _fileController = fileController;
        }

        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadSingleAttachment(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { Type = "error", Message = "No file provided." });

            long maxFileSize = SharedAppConfig.GetMaxAttachmentSize();
            if (file.Length > maxFileSize)
                return BadRequest(new { Type = "error", Message = "File exceeds the size limit." });

            var fileId = await _fileController.UploadFileInternalAsync(
                file, UserId!, isAttachment: true, isEmoji: false, guildId: null, channelId: null
            );

            var pending = new PendingAttachment
            {
                FileId = fileId,
                UserId = UserId!,
                FileName = file.FileName,
                FileSize = file.Length,
                Extension = Path.GetExtension(file.FileName).ToLowerInvariant(),
                IsImage = FileSignatureValidator.IsImageFile(file),
                IsVideo = FileSignatureValidator.IsVideoFile(file),
                CreatedAt = DateTime.UtcNow
            };

            _context.PendingAttachments.Add(pending);
            await _context.SaveChangesAsync();

            return Ok(new { fileId });
        }
    }
}