using LiventCord.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;


namespace LiventCord.Controllers
{
    [ApiController]
    [Route("api/images")]
    [Authorize]
    public class ImageController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly ChannelController _channelController;
        private readonly PermissionsController _permissionsController;
        private readonly ILogger<ImageController> _logger;

        public ImageController(AppDbContext context, ILogger<ImageController> logger, PermissionsController permissionsController, ChannelController channelController)
        {
            _context = context;
            _logger = logger;
            _permissionsController = permissionsController;
            _channelController = channelController;
        }


        [HttpPost("profile")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadProfileImage([FromForm] ProfileImageUploadRequest request)
        {
            try
            {
                var fileId = await UploadFileInternal(request.Photo, UserId!, null, null);
                return Ok(new { fileId });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Type = "error", Message = ex.Message });
            }
        }

        [HttpPost("guild")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadGuildImage([FromForm] GuildImageUploadRequest request)
        {
            if (!await _permissionsController.IsUserAdmin(request.GuildId, UserId!))
                return Forbid();

            try
            {
                var fileId = await UploadFileInternal(request.Photo, UserId!, request.GuildId, null);
                return Ok(new { fileId });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Type = "error", Message = ex.Message });
            }
        }
        public async Task<IActionResult> UploadImage(IFormFile photo, string userId, string? guildId = null)
        {
            try
            {
                string fileId = await UploadFileInternal(photo, userId, guildId, null);
                return Ok(new { fileId });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Type = "error", Message = ex.Message });
            }
        }

        [NonAction]
        public async Task<string> UploadFileInternal(
            IFormFile file,
            string userId,
            string? guildId = null,
            string? channelId = null
        )
        {
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("UserId is null for this request");
                throw new UnauthorizedAccessException("User not authorized.");
            }

            if (file == null || file.Length == 0)
            {
                _logger.LogWarning("No file uploaded.");
                throw new ArgumentException("No file uploaded.");
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!FileExtensions.IsValidImageExtension(extension) || !file.ContentType.StartsWith("image/"))
            {
                _logger.LogWarning("Invalid file type uploaded. File name: {FileName}, Content type: {ContentType}", file.FileName, file.ContentType);
                throw new ArgumentException("Invalid file type. Only images are allowed.");
            }

            _logger.LogInformation("Processing file upload. UserId: {UserId}, GuildId: {GuildId}, ChannelId: {ChannelId}", userId, guildId, channelId);

            string sanitizedFileName = Utils.SanitizeFileName(file.FileName);

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var content = memoryStream.ToArray();
            var fileId = Utils.CreateRandomId();

            if (!string.IsNullOrEmpty(guildId))
            {
                if (!string.IsNullOrEmpty(channelId))
                {
                    _logger.LogInformation("Uploading attachment for ChannelId: {ChannelId} in GuildId: {GuildId}", channelId, guildId);
                    await SaveOrUpdateFile(new AttachmentFile(fileId, sanitizedFileName, content, extension, channelId, guildId, userId));
                }
                else
                {
                    _logger.LogInformation("Uploading guild file for GuildId: {GuildId}", guildId);
                    await SaveOrUpdateFile(new GuildFile(fileId, sanitizedFileName, content, extension, guildId, userId));
                    await SetIsUploadedGuildImg(guildId);
                }
            }
            else
            {
                _logger.LogInformation("Uploading profile file for UserId: {UserId}", userId);
                await SaveOrUpdateFile(new ProfileFile(fileId, sanitizedFileName, content, extension, userId));
            }

            _logger.LogInformation("File uploaded successfully. FileId: {FileId}", fileId);
            return fileId;
        }





        private async Task SetIsUploadedGuildImg(string guildId)
        {
            var guild = await _context.Guilds
                .Where(g => g.GuildId == guildId)
                .FirstOrDefaultAsync();

            if (guild != null)
            {
                guild.IsGuildUploadedImg = true;

                await _context.SaveChangesAsync();
            }
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

                _logger.LogInformation("Updated existing file: {FileId}, Content Length: {ContentLength}", existingFile.FileId, existingFile.Content.Length);
            }
            else
            {
                await _context.Set<T>().AddAsync(newFile);

                _logger.LogInformation("Added new file: {FileId}, Content Length: {ContentLength}", newFile.FileId, newFile.Content.Length);
            }

            await _context.SaveChangesAsync();
        }


        private async Task<T?> GetExistingFile<T>(T newFile)
            where T : FileBase
        {
            string? userId = (newFile as ProfileFile)?.UserId
                            ?? (newFile as GuildFile)?.UserId
                            ?? (newFile as AttachmentFile)?.UserId;
            string? guildId = newFile.GuildId;

            var query = _context.Set<T>().AsQueryable();

            query = query.Where(file => file.FileId == newFile.FileId);

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
                );
            }

            return await query.FirstOrDefaultAsync();
        }



    }
}

public class AttachmentUploadRequest
{
    public required IFormFile File { get; set; }

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