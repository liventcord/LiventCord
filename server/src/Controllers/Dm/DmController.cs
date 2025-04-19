using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [ApiController]
    [Route("api/dm")]
    [Authorize]
    public class DmController : BaseController
    {
        private readonly AppDbContext _dbContext;

        private readonly AppLogicService _appLogicService;
        private readonly FriendDmService _friendDmService;

        public DmController(AppDbContext dbContext, AppLogicService appLogicService, FriendDmService friendDmService)
        {
            _dbContext = dbContext;
            _appLogicService = appLogicService;
            _friendDmService = friendDmService;
        }

        [HttpGet("")]
        public async Task<IActionResult> GetDmEndpoint()
        {
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized("User ID is missing.");

            var publicDmUsers = await _friendDmService.GetDmUsers(UserId);

            return Ok(publicDmUsers);
        }

        [HttpPost("{friendId}")]
        public async Task<IActionResult> AddDmEndpoint([FromRoute][UserIdLengthValidation] string friendId)
        {
            var result = await _friendDmService.AddDmBetweenUsers(UserId!, friendId);
            var result2 = await _friendDmService.AddDmBetweenUsers(friendId!, UserId!);
            var friend = await _friendDmService.GetUserDetails(friendId);
            return result || result2 ? Ok(friend) : Conflict("Direct message relationship already exists.");
        }



        [HttpDelete("{friendId}")]
        public async Task<IActionResult> RemoveDmEndpoint(
            [FromRoute][UserIdLengthValidation] string friendId
        )
        {
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized("User ID is missing.");

            var dmToRemove = await _dbContext.UserDms
                .FirstOrDefaultAsync(d => d.UserId == UserId && d.FriendId == friendId);

            if (dmToRemove == null)
                return NotFound("Direct message relationship not found.");
            _dbContext.UserDms.Remove(dmToRemove);
            await _dbContext.SaveChangesAsync();

            return Ok(new { friendId });
        }
    }
}
