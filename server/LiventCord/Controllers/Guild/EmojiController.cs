using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace LiventCord.Controllers
{
    [Route("api/v1/")]
    [ApiController]
    [Authorize]
    public class EmojiController : BaseController
    {
        private const int MaxEmojisPerGuild = 50;
        private static readonly Regex EmojiNameRegex = new(@"^[a-zA-Z0-9_-]+$", RegexOptions.Compiled);

        private readonly AppDbContext _dbContext;
        private readonly IDbContextFactory<AppDbContext> _dbContextFactory;
        private readonly PermissionsController _permissionsController;
        private readonly FileController _imageController;

        public EmojiController(
            AppDbContext dbContext,
            IDbContextFactory<AppDbContext> dbContextFactory,
            PermissionsController permissionsController,
            FileController imageController
        )
        {
            _dbContext = dbContext;
            _dbContextFactory = dbContextFactory;
            _permissionsController = permissionsController;
            _imageController = imageController;
        }

        [HttpGet("guilds/{guildId}/emojis/")]
        public async Task<IActionResult> GetEmojis([FromRoute][IdLengthValidation] string guildId)
        {
            bool userExists = await _dbContext.DoesMemberExistInGuild(UserId!, guildId);
            if (!userExists)
                return NotFound();

            var emojis = await _dbContext
                .EmojiFiles.Where(f => f.GuildId == guildId)
                .Select(f => new
                {
                    f.FileId,
                    f.GuildId,
                    f.FileName,
                    f.UserId,
                })
                .ToListAsync();

            return Ok(emojis);
        }


        [HttpPost("guilds/emojis")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadEmojiImages([FromForm] GuildEmojiUploadRequest request)
        {
            if (request == null || request.GuildId == null || request.Photos == null || !request.Photos.Any() || UserId == null)
                return BadRequest(new { Type = "error", Message = "Invalid request data." });

            if (!await _permissionsController.CanManageGuild(UserId, request.GuildId))
                return Forbid();

            var existingCount = await _dbContext.EmojiFiles.CountAsync(f => f.GuildId == request.GuildId);
            if (existingCount + request.Photos.Count > MaxEmojisPerGuild)
                return BadRequest(new { Type = "error", Message = $"Guild emoji limit of {MaxEmojisPerGuild} would be exceeded." });


            try
            {
                var emojiIds = new List<string?>();

                foreach (var photo in request.Photos)
                {
                    using var image = await Image.LoadAsync(photo.OpenReadStream());
                    image.Mutate(x => x.Resize(new ResizeOptions
                    {
                        Size = new Size(128, 128),
                        Mode = ResizeMode.Max
                    }));

                    using var ms = new MemoryStream(20 * 1024);
                    await image.SaveAsWebpAsync(ms);
                    ms.Position = 0;

                    if (ms.Length > 256 * 1024)
                        return BadRequest(new { Type = "error", Message = "One or more files exceed the maximum size limit after processing." });

                    var resizedFile = new FormFile(ms, 0, ms.Length, photo.Name, Path.ChangeExtension(photo.FileName, ".webp"))
                    {
                        Headers = photo.Headers,
                        ContentType = "image/webp"
                    };

                    var emojiId = await _imageController.UploadFileInternalAsync(
                        resizedFile,
                        UserId,
                        false,
                        true,
                        request.GuildId,
                        null
                    );

                    emojiIds.Add(emojiId);
                }

                return Ok(new { emojiIds, request.GuildId });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Type = "error", Message = ex.Message });
            }
        }

        [HttpPatch("guilds/{guildId}/emojis/{emojiId}")]
        public async Task<IActionResult> RenameEmojiFile(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string emojiId,
            [FromBody] RenameEmojiRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name)
                || request.Name.Length < 2
                || !EmojiNameRegex.IsMatch(request.Name))
            {
                return BadRequest("Emoji name must be at least 2 characters long and contain only alphanumeric characters and underscores.");
            }

            if (!await _permissionsController.CanManageGuild(UserId!, guildId))
                return Forbid();

            var file = await _dbContext.EmojiFiles.FirstOrDefaultAsync(f =>
                f.FileId == emojiId && f.GuildId == guildId);

            if (file == null)
                return NotFound();

            file.FileName = request.Name;
            await _dbContext.SaveChangesAsync();
            return Ok();
        }

        [HttpDelete("guilds/{guildId}/emojis/{emojiId}")]
        public async Task<IActionResult> DeleteEmojiFile(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string emojiId
        )
        {
            if (!await _permissionsController.CanManageGuild(UserId!, guildId))
                return Forbid();

            var file = await _dbContext.EmojiFiles.FirstOrDefaultAsync(f =>
                f.FileId == emojiId && f.GuildId == guildId);

            if (file == null)
                return NotFound();

            _dbContext.EmojiFiles.Remove(file);
            await _dbContext.SaveChangesAsync();
            return Ok();
        }
    }
}

public class RenameEmojiRequest
{
    public required string Name { get; set; }
}