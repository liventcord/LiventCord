using System.ComponentModel.DataAnnotations;
using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("api/guilds/{guildId}/channels")]
    [ApiController]
    [Authorize]
    public class ChannelController : BaseController
    {
        private readonly AppDbContext _dbContext;
        private readonly ImageController _uploadController;
        private readonly MembersController _membersController;
        private readonly PermissionsController _permissionsController;

        public ChannelController(
            AppDbContext dbContext,
            ImageController uploadController,
            MessageController messageController,
            MembersController membersController,
            PermissionsController permissionsController
        )
        {
            _dbContext = dbContext;
            _uploadController = uploadController;
            _permissionsController = permissionsController;
            _membersController = membersController;
        }

        [HttpGet("")]
        public async Task<IActionResult> HandleGetChannels(
            [FromRoute] [IdLengthValidation] string guildId
        )
        {
            var channels = await GetGuildChannels(UserId!, guildId);

            if (channels == null)
                return BadRequest(new { Type = "error", Message = "Unable to retrieve channels." });

            return Ok(new { guildId, channels });
        }

        [HttpDelete("/{guildId}/channels/{channelId}")]
        public async Task<IActionResult> DeleteChannel(
            [FromRoute] [IdLengthValidation] string guildId,
            [IdLengthValidation] string channelId
        )
        {
            var channel = _dbContext.Channels.Find(channelId);
            if (channel == null)
                return NotFound("Channel does not exist.");

            if (!await _membersController.DoesMemberExistInGuild(UserId!, guildId))
                return BadRequest(new { Type = "error", Message = "User not in guild." });
            if (
                !await _permissionsController.HasPermission(
                    UserId!,
                    guildId,
                    PermissionFlags.ManageChannels
                )
            )
                return Forbid("User is not authorized to delete this channel.");

            _dbContext.Channels.Remove(channel);
            await _dbContext.SaveChangesAsync();
            return Ok();
        }

        [HttpPost("/{guildId}/channels")]
        public async Task<IActionResult> CreateChannel(
            [FromRoute] [IdLengthValidation] string guildId,
            [FromBody] CreateChannelRequest request
        )
        {
            if (!await _permissionsController.CanManageChannels(UserId!, guildId))
                return Unauthorized(
                    new
                    {
                        Type = "error",
                        Message = "User does not have permission to manage channels.",
                    }
                );

            var guild = await _dbContext
                .Guilds.Include(g => g.Channels)
                .FirstOrDefaultAsync(g => g.GuildId == guildId);

            if (guild == null)
                return NotFound(new { Type = "error", Message = "Guild does not exist." });

            var newChannel = new Channel
            {
                ChannelId = Utils.CreateRandomId(),
                ChannelName = request.ChannelName,
                IsTextChannel = request.IsTextChannel,
                GuildId = guildId,
                Order = guild.Channels.Count,
            };

            guild.Channels.Add(newChannel);
            await _dbContext.SaveChangesAsync();

            return Ok();
        }

        [NonAction]
        public async Task<List<ChannelWithLastRead>> GetGuildChannels(string userId, string guildId)
        {
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(guildId))
                return new List<ChannelWithLastRead>();

            return await _dbContext
                .Channels.Where(c => c.GuildId == guildId)
                .Select(c => new ChannelWithLastRead
                {
                    ChannelId = c.ChannelId,
                    ChannelName = c.ChannelName,
                    IsTextChannel = c.IsTextChannel,
                    LastReadDateTime = _dbContext
                        .UserChannels.Where(uc =>
                            uc.UserId == userId && uc.ChannelId == c.ChannelId
                        )
                        .Select(uc => uc.LastReadDatetime)
                        .FirstOrDefault(),
                })
                .ToListAsync();
        }
    }
}

public class CreateChannelRequest
{
    [Required(ErrorMessage = "Channel name is required.")]
    public required string ChannelName { get; set; }

    [Required(ErrorMessage = "IsTextChannel is required.")]
    public required bool IsTextChannel { get; set; }
}
