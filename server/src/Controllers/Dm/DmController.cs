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
            [FromRoute][IdLengthValidation] string friendId
        )
        {
            var result = await AddDmUser(UserId!, friendId);
            return result;
        }

        private async Task<IActionResult> AddDmUser(string userId, string friendId)
        {
            // # TODO: add to dm users
            var friend = await _dbContext
                .Users.Where(u => u.UserId == friendId)
                .Select(u => new { u.UserId })
                .FirstOrDefaultAsync();

            if (friend == null)
                return NotFound("Friend not found.");

            if (friend.UserId == userId)
                return BadRequest("You cannot add yourself as a friend.");

            var existingFriendship = await _dbContext.Friends.AnyAsync(f =>
                (f.UserId == userId && f.FriendId == friend.UserId)
                || (f.UserId == friend.UserId && f.FriendId == userId)
            );

            if (existingFriendship)
                return Conflict("You are already friends with this user.");

            using (var transaction = await _dbContext.Database.BeginTransactionAsync())
            {
                var newFriendship = new Friend
                {
                    UserId = userId,
                    FriendId = friend.UserId,
                    Status = FriendStatus.Pending,
                };

                var reverseFriendship = new Friend
                {
                    UserId = friend.UserId,
                    FriendId = userId,
                    Status = FriendStatus.Pending,
                };

                _dbContext.Friends.Add(newFriendship);
                _dbContext.Friends.Add(reverseFriendship);

                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok("Friend request sent.");
            }
        }
    }
}
