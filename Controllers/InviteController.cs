using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class InviteController : BaseController
    {
        private readonly AppDbContext _dbContext;

        public InviteController(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        [HttpGet("guilds/{guildId}/invites")]
        public async Task<IActionResult> HandleGetInvites(
            [FromRoute] [IdLengthValidation] string guildId
        )
        {
            if (!await _dbContext.DoesGuildExist(guildId))
            {
                return NotFound(new { Type = "error", Message = "Guild does not exist." });
            }

            if (!await _dbContext.DoesMemberExistInGuild(UserId!, guildId))
            {
                return NotFound(
                    new { Type = "error", Message = "Member is not part of the guild." }
                );
            }

            string inviteId = await GetGuildIdByInviteAsync(guildId);
            if (inviteId != null)
            {
                return Ok(new { InviteId = inviteId });
            }

            return NotFound(new { Type = "error", Message = "Invite not found." });
        }

        private string CreateRandomInviteId()
        {
            const int length = 8;
            const string characters =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            var random = new Random();
            return new string(
                Enumerable
                    .Range(0, length)
                    .Select(_ => characters[random.Next(characters.Length)])
                    .ToArray()
            );
        }

        private async Task AddInviteAsync(string guildId)
        {
            var inviteId = CreateRandomInviteId();

            var guildInvite = new GuildInvite
            {
                GuildId = guildId,
                InviteId = inviteId,
                CreatedAt = DateTime.UtcNow,
            };

            _dbContext.GuildInvites.Add(guildInvite);
            await _dbContext.SaveChangesAsync();
        }

        [NonAction]
        public async Task<string?> GetGuildIdByInviteAsync(string inviteId)
        {
            var guildInvite = await _dbContext.GuildInvites.FirstOrDefaultAsync(g =>
                g.InviteId == inviteId
            );

            return guildInvite?.GuildId;
        }
    }
}
