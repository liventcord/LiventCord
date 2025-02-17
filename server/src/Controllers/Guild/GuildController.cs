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
    public class GuildController : BaseController
    {
        private string DEFAULT_CHANNEL_NAME = "general";
        private readonly AppDbContext _dbContext;
        private readonly ImageController _imageController;
        private readonly MembersController _membersController;
        private readonly PermissionsController _permissionsController;

        private readonly ITokenValidationService _tokenValidationService;
        private readonly ILogger<GuildController> _logger;
        public GuildController(
            AppDbContext dbContext,
            ImageController uploadController,
            MessageController messageController,
            MembersController membersController,
            PermissionsController permissionsController, ITokenValidationService tokenValidationService, ILogger<GuildController> logger
        )
        {
            _dbContext = dbContext;
            _imageController = uploadController;
            _permissionsController = permissionsController;
            _membersController = membersController;
            _tokenValidationService = tokenValidationService;
            _logger = logger;
        }

        [HttpGet("")]
        [Authorize]
        public async Task<IActionResult> HandleGetGuilds()
        {
            var guilds = await _membersController.GetUserGuilds(UserId!) ?? new List<GuildDto>();
            return Ok(guilds);
        }



        [HttpPut("{guildId}")]
        [Authorize]
        public async Task<IActionResult> ChangeGuildName([FromRoute][IdLengthValidation] string guildId, [FromBody] ChangeGuildNameRequest request)
        {
            var guild = await _dbContext.Guilds.FindAsync(guildId);
            if (guild == null)
                return NotFound();

            if (!await _permissionsController.IsUserAdmin(guildId, UserId!))
                return Forbid();

            guild.GuildName = request.GuildName;
            await _dbContext.SaveChangesAsync();

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

            guild.Channels.Add(new Channel
            {
                ChannelId = rootChannel,
                GuildId = guildId,
                ChannelName = DEFAULT_CHANNEL_NAME,
                ChannelDescription = "",
                IsPrivate = false,
                IsTextChannel = true,
                Order = 0,
            });

            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == ownerId);
            if (user == null)
            {
                _logger.LogCritical("User not found when creating guild: " + ownerId);
                return null;
            }

            if (guild.GuildMembers.Any(gu => gu.MemberId == ownerId))
                throw new Exception("User already in guild");

            guild.GuildMembers.Add(new GuildMember
            {
                MemberId = ownerId,
                GuildId = guildId,
                Guild = guild,
                User = user,
            });

            _dbContext.Guilds.Add(guild);

            await _permissionsController.AssignPermissions(guildId, ownerId, PermissionFlags.All);
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


        private async Task<IActionResult> HandleGuildCreation(string userId, string guildName, IFormFile? photo, bool? isPublic)
        {
            string rootChannel = Utils.CreateRandomId();
            string guildId = Utils.CreateRandomId();

            var newGuild = await CreateGuild(userId, guildName, rootChannel, guildId, photo, isPublic);
            if (newGuild == null)
                return Problem("Guild creation failed");

            if (photo != null)
            {
                var uploadResult = await _imageController.UploadImage(photo, userId, newGuild.GuildId);
                if (uploadResult is not OkObjectResult uploadResultOk)
                    return uploadResult;
            }

            return StatusCode(201, MapToGuildDto(newGuild));
        }


        [HttpPost("")]
        public async Task<IActionResult> CreateGuildEndpoint([FromForm] CreateGuildRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest();

            return await HandleGuildCreation(UserId!, request.GuildName, request.Photo, request.IsPublic);
        }

        [Authorize]
        [HttpDelete("{guildId}")]
        public async Task<IActionResult> DeleteGuildEndpoint([FromRoute][IdLengthValidation] string guildId)
        {
            var guild = await _dbContext.Guilds.FindAsync(guildId);
            if (guild == null)
                return NotFound();

            if (!await _permissionsController.IsUserAdmin(guildId, UserId!))
                return Forbid();

            _dbContext.Guilds.Remove(guild);
            await _dbContext.SaveChangesAsync();

            return Ok(new { guildId });
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