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

        public ChannelController(
            AppDbContext dbContext,
            ImageController uploadController,
            MembersController membersController,
            PermissionsController permissionsController,
            ITokenValidationService tokenValidationService
        )
        {
            _dbContext = dbContext;
            _permissionsController = permissionsController;
            _membersController = membersController;
            _tokenValidationService = tokenValidationService;

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
                [IdLengthValidation] string channelId
            )
        {
            var channel = _dbContext.Channels.Find(channelId);
            if (channel == null)
                return NotFound("Channel does not exist.");

            if (!await _membersController.DoesMemberExistInGuild(UserId!, guildId))
                return BadRequest(new { Type = "error", Message = "User not in guild." });

            if (!await _permissionsController.HasPermission(UserId!, guildId, PermissionFlags.ManageChannels))
            {
                return new ObjectResult(new { Type = "error", Message = "User is not authorized to delete this channel." })
                {
                    StatusCode = StatusCodes.Status403Forbidden
                };
            }

            _dbContext.Channels.Remove(channel);
            await _dbContext.SaveChangesAsync();
            return Ok(new { guildId, channelId });
        }


        [HttpPost("/api/guilds/{guildId}")]
        public async Task<IActionResult> CreateChannel([FromRoute][IdLengthValidation] string guildId, [FromBody] CreateChannelRequest request)
        {
            if (!await _permissionsController.CanManageChannels(UserId!, guildId))
                return Unauthorized(new { Type = "error", Message = "User does not have permission to manage channels." });

            return await CreateChannelInternal(guildId, Utils.CreateRandomId(), request.ChannelName, request.IsTextChannel, request.IsPrivate, returnResponse: true);
        }

        [HttpPost("/api/discord/bot/guilds/{guildId}/channels/")]
        public async Task<IActionResult> CreateChannelBot([FromRoute] string guildId, [FromBody] CreateChannelRequestBot request)
        {
            string? token = Request.Headers["Authorization"];
            if (token == null || !_tokenValidationService.ValidateToken(token))
                return Forbid();

            return await CreateChannelInternal(guildId, request.ChannelId, request.ChannelName, isTextChannel: true, isPrivate: false, returnResponse: false);
        }

        private async Task<IActionResult> CreateChannelInternal(string guildId, string channelId, string channelName, bool isTextChannel, bool isPrivate, bool returnResponse)
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

            return returnResponse ? Ok(new { guildId, newChannel.ChannelId, isTextChannel, channelName }) : Ok();
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
    public required string ChannelName { get; set; }
    public required bool IsTextChannel { get; set; }
    public required bool IsPrivate { get; set; }
}

public class CreateChannelRequestBot
{
    public required string ChannelId { get; set; }
    public required string ChannelName { get; set; }
}