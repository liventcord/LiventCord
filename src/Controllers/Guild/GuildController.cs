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
        private readonly ImageController _uploadController;
        private readonly MembersController _membersController;
        private readonly PermissionsController _permissionsController;

        public GuildController(
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
        public async Task<IActionResult> HandleGetGuilds()
        {
            var guilds = await _membersController.GetUserGuilds(UserId!) ?? new List<GuildDto>();
            return Ok(guilds);
        }

        [HttpPost("")]
        public async Task<IActionResult> CreateGuild([FromForm] CreateGuildRequest request)
        {
            string rootChannel = Utils.CreateRandomId();

            var newGuild = await CreateGuild(
                UserId!,
                request.GuildName,
                rootChannel,
                request.Photo,
                request.IsPublic
            );

            if (request.Photo != null)
            {
                var uploadResult = await _uploadController.UploadImage(
                    request.Photo,
                    UserId!,
                    newGuild.GuildId
                );

                if (uploadResult is not OkObjectResult uploadResultOk)
                    return uploadResult;

                var value = uploadResultOk.Value;

                if (value == null)
                    return new BadRequestResult();
                dynamic dynamicValue = value;
                var fileId = dynamicValue?.fileId;

                if (fileId == null)
                    return new BadRequestResult();
            }

            var guildDto = new GuildDto
            {
                GuildId = newGuild.GuildId,
                OwnerId = newGuild.OwnerId,
                GuildName = newGuild.GuildName,
                RootChannel = newGuild.RootChannel,
                Region = newGuild.Region,
                IsGuildUploadedImg = newGuild.IsGuildUploadedImg,
                GuildMembers = newGuild.GuildMembers.Select(gu => gu.MemberId).ToList(),
            };

            return CreatedAtAction(nameof(CreateGuild), new { id = guildDto.GuildId }, guildDto);
        }

        private async Task<Guild> CreateGuild(
            string ownerId,
            string guildName,
            string rootChannel,
            IFormFile? formFile,
            bool isPublic
        )
        {
            var guildId = Utils.CreateRandomId();

            var guild = new Guild(
                guildId,
                ownerId,
                guildName,
                rootChannel,
                null,
                formFile != null,
                isPublic
            );

            guild.Channels.Add(
                new Channel
                {
                    ChannelId = rootChannel,
                    GuildId = guildId,
                    ChannelName = DEFAULT_CHANNEL_NAME,
                    ChannelDescription = "",
                    IsTextChannel = true,
                    Order = 0,
                }
            );

            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == ownerId);
            if (user == null)
                throw new Exception("User not found. " + ownerId);

            if (guild.GuildMembers.Any(gu => gu.MemberId == ownerId))
                throw new Exception("User already in guild");

            var guildMember = new GuildMember
            {
                MemberId = ownerId,
                GuildId = guildId,
                Guild = guild,
                User = user,
            };

            Console.WriteLine(
                $"Adding GuildUser: GuildId = {guildMember.GuildId}, MemberId = {guildMember.MemberId}, UserId = {guildMember.User.UserId}"
            );

            guild.GuildMembers.Add(guildMember);

            Console.WriteLine(
                $"Guild Details: GuildId = {guild.GuildId}, OwnerId = {guild.OwnerId}, GuildName = {guild.GuildName}"
            );

            _dbContext.Guilds.Add(guild);

            await _permissionsController.AssignPermissions(guildId, ownerId, PermissionFlags.All);

            await _dbContext.SaveChangesAsync();

            return guild;
        }

        [HttpDelete("/api/guilds/{guildId}")]
        public async Task<IActionResult> DeleteGuildEndpoint(
            [FromRoute] [IdLengthValidation] string guildId
        )
        {
            if (string.IsNullOrEmpty(guildId))
                return BadRequest(new { Type = "error", Message = "Guild ID is required." });

            var guild = await _dbContext.Guilds.FindAsync(guildId);
            if (guild == null)
                return NotFound();

            if (!await _permissionsController.IsUserAdmin(guildId, UserId!))
                return Forbid();

            _dbContext.Channels.RemoveRange(guild.Channels);
            _dbContext.GuildMembers.RemoveRange(guild.GuildMembers);
            _dbContext.GuildPermissions.RemoveRange(guild.GuildPermissions);
            _dbContext.Guilds.Remove(guild);

            await _dbContext.SaveChangesAsync();

            return Ok(new { guildId });

        }
    }
}

public class CreateGuildRequest
{
    public required string GuildName { get; set; }
    public required bool IsPublic { get; set; }
    public IFormFile? Photo { get; set; }
}

public class GuildInvite
{
    [Key]
    public required string InviteId { get; set; }
    public required string GuildId { get; set; }
    public DateTime CreatedAt { get; set; }
}
