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

        public DmController(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        [HttpGet("")]
        public async Task<IActionResult> GetDmEndpoint()
        {
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized("User ID is missing.");

            var publicDmUsers = await _dbContext
                .UserDms.Where(d => d.UserId == UserId)
                .Join(
                    _dbContext.Users,
                    friend => friend.FriendId,
                    user => user.UserId,
                    (friend, user) => user.GetPublicUser()
                )
                .ToListAsync();

            return Ok(publicDmUsers);
        }

        [HttpPost("{friendId}")]
        public async Task<IActionResult> AddDmEndpoint(
            [FromRoute][UserIdLengthValidation] string friendId
        )
        {
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized("User ID is missing.");

            var existingDm = await _dbContext.UserDms
                .FirstOrDefaultAsync(d => d.UserId == UserId && d.FriendId == friendId);

            if (existingDm != null)
                return Conflict("Direct message relationship already exists.");

            var newDm = new UserDm
            {
                UserId = UserId,
                FriendId = friendId
            };

            await _dbContext.UserDms.AddAsync(newDm);
            await _dbContext.SaveChangesAsync();

            return Ok();
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

            return Ok();
        }
    }
}
