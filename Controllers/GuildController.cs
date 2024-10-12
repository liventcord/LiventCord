using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MyPostgresApp.Data;
using MyPostgresApp.Helpers;
using MyPostgresApp.Models;
using System.Security.Claims;
using System.Threading.Tasks;

namespace MyPostgresApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class GuildController : ControllerBase
    {
        private readonly AppDbContext _dbContext;
        private readonly UploadController _uploadController;

        public GuildController(AppDbContext dbContext, UploadController uploadController)
        {
            _dbContext = dbContext;
            _uploadController = uploadController;
        }

        public class CreateGuildRequest
        {
            public required string GuildName { get; set; }
            public IFormFile? Photo { get; set; }
        }

        [HttpPost("create_guild")]
        public async Task<IActionResult> CreateGuild([FromForm] CreateGuildRequest request)
        {
            if (string.IsNullOrEmpty(request.GuildName))
                return BadRequest("Guild name is required.");

            var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized("User not authenticated.");

            string rootChannel = Utils.CreateRandomId();
            string? region = Request.Headers["Region"].ToString();
            if (string.IsNullOrEmpty(region))
                region = null;

            var guildService = new GuildService(_dbContext);
            var newGuild = await guildService.CreateGuild(userId, request.GuildName, rootChannel, region);

            if (request.Photo != null)
            {
                var uploadResult = await _uploadController.UploadImage(request.Photo, newGuild.GuildId);
                if (uploadResult is OkObjectResult uploadResultOk)
                {
                    var fileId = ((dynamic)uploadResultOk.Value).fileId;
                }
                else
                {
                    return uploadResult; 
                }
            }

            // Map to DTO before returning
            var guildDto = new GuildDto
            {
                GuildId = newGuild.GuildId,
                OwnerId = newGuild.OwnerId,
                GuildName = newGuild.GuildName,
                RootChannel = newGuild.RootChannel,
                Region = newGuild.Region,
                IsGuildUploadedImg = newGuild.IsGuildUploadedImg,
                GuildUsers = newGuild.GuildUsers.Select(gu => gu.UserId).ToList() // Return only User IDs
            };

            return CreatedAtAction(nameof(CreateGuild), new { id = guildDto.GuildId }, guildDto);
        }

    }
}
