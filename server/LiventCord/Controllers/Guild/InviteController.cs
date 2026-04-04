using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("api/v1/")]
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
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(1));

            var operation = Task.Run(async () =>
            {
                if (!await _dbContext.DoesGuildExist(guildId))
                    return (IActionResult)NotFound(new { Type = "error", Message = "Guild does not exist." });

                if (!await _permissionController.CanInvite(UserId!, guildId))
                    return Forbid();

                string? inviteId = await GetInviteIdByGuildAsync(guildId);

                if (inviteId == null)
                {
                    await AddInviteAsync(guildId, channelId, UserId!);
                    inviteId = _dbContext
                        .GuildInvites.Where(g => g.GuildId == guildId)
                        .Select(g => g.InviteId)
                        .FirstOrDefault();
                }

                return Ok(new { inviteId });
            }, cts.Token);

            var completed = await Task.WhenAny(operation, Task.Delay(Timeout.Infinite, cts.Token));

            if (completed != operation)
                return StatusCode(408, new { Type = "error", Message = "Request timed out." });

            return await operation;
        }

        [HttpPost("guilds/{guildId}/channels/{channelId}/invites")]
        public async Task<IActionResult> HandleCreateInvite(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string channelId
        )
        {
            if (!await _dbContext.DoesGuildExist(guildId))
                return NotFound(new { Type = "error", Message = "Guild does not exist." });

            if (!await _dbContext.DoesMemberExistInGuild(UserId!, guildId))
                return Forbid();

            if (!await _permissionController.CanInvite(UserId!, guildId))
                return Forbid();

            await AddInviteAsync(guildId, channelId, UserId!);

            var invite = await _dbContext.GuildInvites
                .Where(g => g.GuildId == guildId && g.InviteChannelId == channelId)
                .OrderByDescending(g => g.CreatedAt)
                .Select(g => new
                {
                    g.InviteId,
                    g.InviteChannelId,
                    g.CreatedAt,
                    g.CreatedByUserId,
                    g.Usages
                })
                .FirstOrDefaultAsync();

            return Ok(new { guildId, invite });
        }

        [HttpDelete("guilds/{guildId}/invites/{inviteId}")]
        public async Task<IActionResult> HandleDeleteInvite(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute] string inviteId
        )
        {
            if (!await _dbContext.DoesGuildExist(guildId))
                return NotFound(new { Type = "error", Message = "Guild does not exist." });

            if (!await _dbContext.DoesMemberExistInGuild(UserId!, guildId))
                return Forbid();

            if (!await _permissionController.CanInvite(UserId!, guildId))
                return Forbid();

            var invite = await _dbContext.GuildInvites.FirstOrDefaultAsync(g =>
                g.InviteId == inviteId && g.GuildId == guildId
            );

            if (invite == null)
                return NotFound(new { Type = "error", Message = "Invite does not exist." });

            _dbContext.GuildInvites.Remove(invite);
            await _dbContext.SaveChangesAsync();

            return Ok(new { guildId, inviteId });
        }

        [HttpGet("guilds/{guildId}/invites")]
        public async Task<IActionResult> HandleListInvites(
            [FromRoute][IdLengthValidation] string guildId
        )
        {
            if (!await _dbContext.DoesGuildExist(guildId))
                return NotFound(new { Type = "error", Message = "Guild does not exist." });

            if (!await _dbContext.DoesMemberExistInGuild(UserId!, guildId))
                return Forbid();

            var invites = await _dbContext.GuildInvites
                .Where(g => g.GuildId == guildId)
                .Select(g => new
                {
                    g.InviteId,
                    g.InviteChannelId,
                    g.CreatedAt,
                    g.CreatedByUserId,
                    g.Usages
                })
                .ToListAsync();

            return Ok(new { guildId, invites });
        }

        [NonAction]
        public async Task IncrementInviteUsageAsync(string inviteId)
        {
            var invite = await _dbContext.GuildInvites.FirstOrDefaultAsync(g => g.InviteId == inviteId);
            if (invite != null)
            {
                invite.Usages++;
                await _dbContext.SaveChangesAsync();
            }
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

        [NonAction]
        public async Task AddInviteAsync(string guildId, string channelId, string createdByUserId)
        {
            var inviteId = CreateRandomInviteId();
            var guildInvite = new GuildInvite
            {
                GuildId = guildId,
                InviteId = inviteId,
                InviteChannelId = channelId,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = createdByUserId,
                Usages = 0,
            };
            _dbContext.GuildInvites.Add(guildInvite);
            await _dbContext.SaveChangesAsync();
        }

        [NonAction]
        public async Task<(string? GuildId, string? ChannelId)> GetGuildIdByInviteAsync(
            string inviteId
        )
        {
            var guildInvite = await _dbContext.GuildInvites.FirstOrDefaultAsync(g =>
                g.InviteId == inviteId
            );

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
    public required string CreatedByUserId { get; set; }
    public int Usages { get; set; } = 0;
}