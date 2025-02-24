using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("api/")]
    [ApiController]
    [Authorize]
    public class InviteController : BaseController
    {
        static readonly int inviteIdLength = 8;
        private readonly AppDbContext _dbContext;
        private readonly PermissionsController _permissionController;

        public InviteController(AppDbContext dbContext, PermissionsController permissionController)
        {
            _dbContext = dbContext;
            _permissionController = permissionController;
        }
        [HttpGet("guilds/{guildId}/channels/{channelId}/invites")]
        public async Task<IActionResult> HandleGetInvites(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string channelId
        )
        {
            if (!await _dbContext.DoesGuildExist(guildId))
            {
                return NotFound(new { Type = "error", Message = "Guild does not exist." });
            }

            if (!await _permissionController.CanInvite(UserId!, guildId))
                return Unauthorized();

            string? inviteId = await GetInviteIdByGuildAsync(guildId);

            if (inviteId == null)
            {
                await AddInviteAsync(guildId, channelId);
                inviteId = _dbContext.GuildInvites
                                    .Where(g => g.GuildId == guildId)
                                    .Select(g => g.InviteId)
                                    .FirstOrDefault();
            }
            return Ok(new { inviteId });
        }


        private string CreateRandomInviteId()
        {
            const string characters =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            var random = new Random();
            return new string(
                Enumerable
                    .Range(0, inviteIdLength)
                    .Select(_ => characters[random.Next(characters.Length)])
                    .ToArray()
            );
        }

        public async Task AddInviteAsync(string guildId, string channelId)
        {
            var inviteId = CreateRandomInviteId();

            var guildInvite = new GuildInvite
            {
                GuildId = guildId,
                InviteId = inviteId,
                InviteChannelId = channelId,
                CreatedAt = DateTime.UtcNow,
            };

            _dbContext.GuildInvites.Add(guildInvite);
            await _dbContext.SaveChangesAsync();
        }

        [NonAction]
        public async Task<(string? GuildId, string? ChannelId)> GetGuildIdByInviteAsync(string inviteId)
        {
            var guildInvite = await _dbContext.GuildInvites
                .FirstOrDefaultAsync(g => g.InviteId == inviteId);

            return (guildInvite?.GuildId, guildInvite?.InviteChannelId);
        }


        [NonAction]
        public async Task<string?> GetInviteIdByGuildAsync(string guildId)
        {
            var guildInvite = await _dbContext.GuildInvites.FirstOrDefaultAsync(g =>
                g.GuildId == guildId
            );
            return guildInvite?.InviteId;
        }

    }
}

public class GuildInvite
{
    [Key]
    public required string InviteId { get; set; }
    public required string GuildId { get; set; }
    public string? InviteChannelId { get; set; }
    public DateTime CreatedAt { get; set; }
}
