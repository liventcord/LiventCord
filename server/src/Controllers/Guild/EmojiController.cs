using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("api/")]
    [ApiController]
    [Authorize]
    public class EmojiController : BaseController
    {
        private readonly AppDbContext _dbContext;
        private readonly PermissionsController _permissionsController;
        private readonly FileController _imageController;

        public EmojiController(AppDbContext dbContext, PermissionsController permissionsController, FileController imageController)
        {
            _dbContext = dbContext;
            _permissionsController = permissionsController;
            _imageController = imageController;
        }

        [HttpGet("guilds/{guildId}/emojis/")]
        public async Task<IActionResult> GetEmojis([FromRoute][IdLengthValidation] string guildId)
        {
            bool userExists = await _dbContext.DoesMemberExistInGuild(UserId!, guildId);
            if (!userExists)
            {
                return NotFound();
            }
            var emojis = await _dbContext.EmojiFiles
                                         .Where(f => f.GuildId == guildId)
                                         .Select(f => new { f.FileId, f.GuildId, f.FileName, f.UserId })
                                         .ToListAsync();

            if (emojis == null || emojis.Count == 0)
            {
                return NotFound();
            }

            return Ok(emojis);
        }
        private bool isEmojiSizeValid(IFormFile formFile)
        {
            return formFile.Length <= 256 * 1024;
        }
        [HttpPost("guilds/emojis")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadEmojiImages([FromForm] GuildEmojiUploadRequest request)
        {
            if (request == null || request.GuildId == null || request.Photos == null || !request.Photos.Any() || UserId == null)
            {
                return BadRequest(new { Type = "error", Message = "Invalid request data." });
            }

            if (!await _permissionsController.CanManageGuild(UserId, request.GuildId))
                return Forbid();

            var emojiIds = new List<string>();

            foreach (var photo in request.Photos)
            {
                if (!isEmojiSizeValid(photo))
                {
                    return BadRequest(new { Type = "error", Message = "One or more files exceed the maximum size limit." });
                }

                try
                {
                    var fileId = await _imageController.UploadFileInternal(photo, UserId, false, true, request.GuildId, null);
                    emojiIds.Add(fileId);
                }
                catch (Exception ex)
                {
                    return BadRequest(new { Type = "error", Message = ex.Message });
                }
            }

            return Ok(new { emojiIds, request.GuildId });
        }

        [HttpPut("guilds/{guildId}/emojis/{emojiId}")]
        public async Task<IActionResult> RenameEmojiFile(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string emojiId,
            [FromBody] string name)
        {
            if (string.IsNullOrWhiteSpace(name) || name.Length < 2 || !Regex.IsMatch(name, @"^[a-zA-Z0-9_]+$"))
            {
                return BadRequest("Emoji name must be at least 2 characters long and contain only alphanumeric characters and underscores.");
            }

            bool canManageGuild = await _permissionsController.CanManageGuild(UserId!, guildId);
            if (!canManageGuild)
            {
                return Forbid();
            }

            try
            {
                var file = await _dbContext.EmojiFiles.FirstAsync(f => f.FileId == emojiId && f.GuildId == guildId);
                file.FileName = name;
                await _dbContext.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException)
            {
                return NotFound();
            }
            catch (Exception)
            {
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpDelete("guilds/{guildId}/emojis/{emojiId}")]
        public async Task<IActionResult> DeleteEmojiFile([FromRoute][IdLengthValidation] string guildId, [FromRoute][IdLengthValidation] string emojiId)
        {
            bool canManageGuild = await _permissionsController.CanManageGuild(UserId!, guildId);
            if (!canManageGuild)
            {
                return Forbid();
            }

            try
            {
                var file = await _dbContext.EmojiFiles.FirstAsync(f => f.FileId == emojiId && f.GuildId == guildId);
                _dbContext.EmojiFiles.Remove(file);
                await _dbContext.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException)
            {
                return NotFound();
            }
            catch (Exception)
            {
                return StatusCode(500, "Internal server error");
            }
        }

    }
}
