using System.ComponentModel.DataAnnotations;
using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("/api/guilds")]
    [ApiController]
    [Authorize]
    public class GuildController : BaseController
    {
        private string DEFAULT_CHANNEL_NAME = "general";
        private readonly AppDbContext _dbContext;
        private readonly FileController _imageController;
        private readonly MembersController _membersController;
        private readonly PermissionsController _permissionsController;
        private readonly InviteController _inviteController;
        private readonly IAppLogger<GuildController> _logger;
        private readonly ICacheService _cacheService;

        public GuildController(
            AppDbContext dbContext,
            FileController uploadController,
            MessageController messageController,
            MembersController membersController,
            PermissionsController permissionsController,
            InviteController inviteController,
            IAppLogger<GuildController> logger,
            ICacheService cacheService
        )
        {
            _dbContext = dbContext;
            _imageController = uploadController;
            _permissionsController = permissionsController;
            _membersController = membersController;
            _inviteController = inviteController;
            _logger = logger;
            _cacheService = cacheService;
        }

        [HttpGet("")]
        public async Task<IActionResult> HandleGetGuilds()
        {
            var guilds = await _membersController.GetUserGuilds(UserId!) ?? new List<GuildDto>();
            return Ok(guilds);
        }

        [HttpPut("{guildId}")]
        public async Task<IActionResult> ChangeGuildName(
            [FromRoute][IdLengthValidation] string guildId,
            [FromBody] ChangeGuildNameRequest request
        )
        {
            var guild = await _dbContext.Guilds.FindAsync(guildId);
            if (guild == null)
                return NotFound();
            string userId = UserId!;
            if (!await _permissionsController.IsUserAdmin(userId, guildId))
                return StatusCode(StatusCodes.Status403Forbidden);

            guild.GuildName = request.GuildName;
            await _dbContext.SaveChangesAsync();
            await _membersController.InvalidateGuildMemberCaches(userId, guildId);

            return Ok(new { guildId, request.GuildName });
        }

        [NonAction]
        public async Task<Guild?> CreateGuild(
            string ownerId,
            string guildName,
            string rootChannel,
            string guildId,
            IFormFile? photo = null,
            bool? isPublic = false
        )
        {
            var guild = new Guild(
                guildId,
                ownerId,
                guildName,
                rootChannel,
                null,
                photo != null,
                isPublic != false
            );

            guild.Channels.Add(
                new Channel
                {
                    ChannelId = rootChannel,
                    GuildId = guildId,
                    ChannelName = DEFAULT_CHANNEL_NAME,
                    ChannelDescription = "",
                    IsPrivate = false,
                    IsTextChannel = true,
                    Order = 0,
                }
            );

            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == ownerId);
            if (user == null)
            {
                _logger.LogError("User not found when creating guild: " + ownerId);
                return null;
            }

            if (guild.GuildMembers.Any(gu => gu.MemberId == ownerId))
                throw new Exception("User already in guild");

            guild.GuildMembers.Add(
                new GuildMember
                {
                    MemberId = ownerId,
                    GuildId = guildId,
                    Guild = guild,
                    User = user,
                }
            );

            _dbContext.Guilds.Add(guild);

            await _permissionsController.AddPermissions(guildId, ownerId, PermissionFlags.All);

            await _dbContext.SaveChangesAsync();

            return guild;
        }

        private GuildDto MapToGuildDto(Guild guild)
        {
            return new GuildDto
            {
                GuildId = guild.GuildId,
                OwnerId = guild.OwnerId,
                GuildName = guild.GuildName,
                RootChannel = guild.RootChannel,
                Region = guild.Region,
                IsGuildUploadedImg = guild.IsGuildUploadedImg,
                GuildMembers = guild.GuildMembers.Select(gu => gu.MemberId).ToList(),
            };
        }

        [HttpPost("")]
        public async Task<IActionResult> CreateGuildEndpoint([FromForm] CreateGuildRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest();
            var userId = UserId!;
            var guildName = request.GuildName;
            var photo = request.Photo;
            var isPublic = request.IsPublic;
            string rootChannel = Utils.CreateRandomId();
            string guildId = Utils.CreateRandomId();

            _cacheService.InvalidateCache(userId);

            var newGuild = await CreateGuild(
                userId,
                guildName,
                rootChannel,
                guildId,
                photo,
                isPublic
            );
            if (newGuild == null)
                return Problem("Guild creation failed");

            var guild = MapToGuildDto(newGuild);
            var permissions = await _permissionsController.GetPermissionsMapForUser(userId);

            return StatusCode(201, new { guild, permissions });
        }

        [HttpDelete("{guildId}")]
        public async Task<IActionResult> DeleteGuildEndpoint(
            [FromRoute][IdLengthValidation] string guildId
        )
        {
            try
            {
                var guild = await _dbContext.Guilds.FindAsync(guildId);
                if (guild == null)
                    return NotFound();

                string userId = UserId!;
                if (!await _permissionsController.IsUserAdmin(userId, guildId))
                    return StatusCode(StatusCodes.Status403Forbidden);

                var messages = await _dbContext
                    .Messages.Where(m =>
                        _dbContext.Channels.Any(c =>
                            c.GuildId == guildId && c.ChannelId == m.ChannelId
                        )
                    )
                    .ToListAsync();

                _imageController.DeleteAttachmentFilesAsync(messages);

                _dbContext.Guilds.Remove(guild);

                try
                {
                    await _dbContext.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!await _dbContext.Guilds.AnyAsync(g => g.GuildId == guildId))
                        return NotFound();

                    throw;
                }

                await _membersController.InvalidateGuildMemberCaches(userId, guildId);
                return Ok(new { guildId });
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while deleting the guild." }
                );
            }
        }
    }
}

public class CreateGuildRequest
{
    [MaxLength(32)]
    public required string GuildName { get; set; }
    public bool? IsPublic { get; set; }
    public IFormFile? Photo { get; set; }
}

public class ChangeGuildNameRequest
{
    [MaxLength(32)]
    public required string GuildName { get; set; }
}
