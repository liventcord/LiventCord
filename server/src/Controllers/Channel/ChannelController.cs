using System.ComponentModel.DataAnnotations;
using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("")]
    [ApiController]
    public class ChannelController : BaseController
    {
        private readonly AppDbContext _dbContext;
        private readonly MembersController _membersController;
        private readonly PermissionsController _permissionsController;
        private readonly ITokenValidationService _tokenValidationService;
        private readonly RedisEventEmitter _redisEventEmitter;
        private readonly ImageController _imageController;

        public ChannelController(
            AppDbContext dbContext,
            MembersController membersController,
            PermissionsController permissionsController,
            ITokenValidationService tokenValidationService,
            RedisEventEmitter redisEventEmitter,
            ImageController imageController
        )
        {
            _dbContext = dbContext;
            _permissionsController = permissionsController;
            _membersController = membersController;
            _tokenValidationService = tokenValidationService;
            _redisEventEmitter = redisEventEmitter;
            _imageController = imageController;

        }
        [Authorize]

        [HttpGet("/api/guilds/{guildId}/channels")]
        public async Task<IActionResult> HandleGetChannels(
                [FromRoute][IdLengthValidation] string guildId
            )
        {
            var channels = await GetGuildChannels(UserId!, guildId);

            if (channels == null)
                return BadRequest(new { Type = "error", Message = "Unable to retrieve channels." });

            return Ok(new { guildId, channels });
        }

        [Authorize]
        [HttpDelete("/api/guilds/{guildId}/channels/{channelId}")]
        public async Task<IActionResult> DeleteChannel(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string channelId
        )
        {
            var channel = await _dbContext.Channels.FindAsync(channelId);
            if (channel == null)
                return NotFound("Channel does not exist.");

            if (!await _membersController.DoesMemberExistInGuild(UserId!, guildId))
                return BadRequest(new { Type = "error", Message = "User not in guild." });

            if (!await _permissionsController.HasPermission(UserId!, guildId, PermissionFlags.ManageChannels))
            {
                return Forbid();
            }

            var messages = await _dbContext.Messages.Where(m => m.ChannelId == channelId).ToListAsync();

            await _imageController.DeleteAttachmentFiles(messages);

            _dbContext.Channels.Remove(channel);
            await _dbContext.SaveChangesAsync();
            await _redisEventEmitter.EmitToGuild(EventType.DELETE_CHANNEL, channel, guildId, UserId!);

            return Ok(new { guildId, channelId });
        }

        [Authorize]
        [HttpPost("/api/guilds/{guildId}/channels/{channelId}")]
        public async Task<IActionResult> EditChannelName(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string channelId,
            [FromBody] ChangeChannelNameRequest request
        )
        {
            var channel = await _dbContext.Channels.FindAsync(channelId);
            if (channel == null)
                return NotFound("Channel does not exist.");

            if (!await _membersController.DoesMemberExistInGuild(UserId!, guildId))
                return BadRequest(new { Type = "error", Message = "User not in guild." });

            if (!await _permissionsController.CanManageChannels(UserId!, guildId))
            {
                return Forbid();
            }
            channel.ChannelName = request.ChannelName;
            await _dbContext.SaveChangesAsync();
            var channelToEmit = new { channelId, channelName = request.ChannelName, guildId };

            await _redisEventEmitter.EmitToGuild(EventType.UPDATE_CHANNEL_NAME, channelToEmit, guildId, UserId!);

            return Ok(new { guildId, channelId, request.ChannelName });
        }


        [Authorize]
        [HttpPost("/api/guilds/{guildId}/channels")]
        public async Task<IActionResult> CreateChannel([FromRoute][IdLengthValidation] string guildId, [FromBody] CreateChannelRequest request)
        {
            if (!await _permissionsController.CanManageChannels(UserId!, guildId))
                return Forbid();

            return await CreateChannelInternal(UserId!, guildId, Utils.CreateRandomId(), request.ChannelName, request.IsTextChannel, request.IsPrivate, recipientId: null, returnResponse: true);
        }

        [HttpPost("/api/discord/bot/guilds/{guildId}/channels/")]
        public async Task<IActionResult> CreateChannelBot([FromRoute] string guildId, [FromBody] CreateChannelRequestBot request)
        {
            string? token = Request.Headers["Authorization"];
            if (token == null || !_tokenValidationService.ValidateToken(token))
                return Forbid();

            return await CreateChannelInternal(null, guildId, request.ChannelId, request.ChannelName, isTextChannel: true, isPrivate: false, recipientId: null, returnResponse: false);
        }

        [NonAction]
        public async Task<IActionResult> CreateChannelInternal(string? userId, string? guildId, string channelId, string channelName, bool isTextChannel, bool isPrivate, string? recipientId, bool returnResponse)
        {
            if (string.IsNullOrEmpty(guildId) && string.IsNullOrEmpty(recipientId))
                return BadRequest(new { Type = "error", Message = "Either GuildId or RecipientId must be provided." });

            if (!string.IsNullOrEmpty(guildId))
            {
                return await HandleGuildChannelCreation(userId, guildId, channelId, channelName, isTextChannel, isPrivate, returnResponse);
            }
            else if (!string.IsNullOrEmpty(recipientId))
            {
                return await HandleDmChannelCreation(userId, recipientId, channelId, channelName, isTextChannel, isPrivate, returnResponse);
            }

            return BadRequest(new { Type = "error", Message = "Invalid request." });
        }

        private async Task<IActionResult> HandleGuildChannelCreation(string? userId, string guildId, string channelId, string channelName, bool isTextChannel, bool isPrivate, bool returnResponse)
        {
            var guild = await _dbContext.Guilds.Include(g => g.Channels).FirstOrDefaultAsync(g => g.GuildId == guildId);
            var dbguilds = await _dbContext.Guilds.Select(g => g.GuildId).ToListAsync();

            if (guild == null)
                return NotFound(new { Type = "error", Message = "Guild does not exist. Available guilds: " + string.Join(", ", dbguilds) });

            if (guild.Channels.Any(c => c.ChannelId == channelId))
                return Conflict(new { Type = "error", Message = "Channel with the same ID already exists." });

            var newChannel = new Channel
            {
                ChannelId = channelId,
                ChannelName = channelName,
                IsTextChannel = isTextChannel,
                IsPrivate = isPrivate,
                GuildId = guildId,
                Order = guild.Channels.Count
            };

            guild.Channels.Add(newChannel);
            await _dbContext.SaveChangesAsync();
            if(userId != null) {
                await _redisEventEmitter.EmitToGuild(EventType.CREATE_CHANNEL, newChannel, guildId, userId);
            }

            return returnResponse ? Ok(new { guildId, newChannel.ChannelId, isTextChannel, channelName }) : Ok();
        }

        private async Task<IActionResult> HandleDmChannelCreation(string userId, string recipientId, string channelId, string channelName, bool isTextChannel, bool isPrivate, bool returnResponse)
        {
            var existingChannel = await _dbContext.Channels
                .FirstOrDefaultAsync(c => c.RecipientId == recipientId && c.IsPrivate && c.IsTextChannel);

            if (existingChannel != null)
                return Conflict(new { Type = "error", Message = "DM channel with this recipient already exists." });

            var newDmChannel = new Channel
            {
                ChannelId = channelId,
                ChannelName = channelName,
                IsTextChannel = isTextChannel,
                IsPrivate = isPrivate,
                RecipientId = recipientId,
                Order = 0
            };

            _dbContext.Channels.Add(newDmChannel);
            await _dbContext.SaveChangesAsync();
            await _redisEventEmitter.EmitToFriend(EventType.CREATE_CHANNEL, newDmChannel, userId, recipientId);

            return returnResponse ? Ok(new { recipientId, newDmChannel.ChannelId, isTextChannel, channelName }) : Ok();
        }

        [NonAction]
        public async Task<bool> DoesChannelExists(string guildId, string channelId)
        {
            return await _dbContext.Channels.AnyAsync(c => c.ChannelId == channelId && c.GuildId == guildId);
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
    [MaxLength(100)]
    public required string ChannelName { get; set; }
    public required bool IsTextChannel { get; set; }
    public required bool IsPrivate { get; set; }
}

public class CreateChannelRequestBot
{
    [IdLengthValidation]
    public required string ChannelId { get; set; }
    [MaxLength(100)]
    public required string ChannelName { get; set; }
}
public class ChangeChannelNameRequest
{
    [MaxLength(100)]
    public required string ChannelName { get; set; }

}