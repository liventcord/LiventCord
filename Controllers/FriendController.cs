using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [ApiController]
    [Route("api/friends")]
    [Authorize]
    public class FriendController : BaseController
    {
        [HttpGet("")]
        public async Task<IActionResult> GetFriendEndpoint()
        {
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized("User ID is missing.");

            var friends = await GetFriends(UserId);
            return Ok(friends);
        }

        [HttpPost("")]
        public async Task<IActionResult> AddFriendEndpoint(
            [FromQuery] string friendName,
            [FromQuery] string friendDiscriminator
        )
        {
            if (
                string.IsNullOrWhiteSpace(friendName)
                || string.IsNullOrWhiteSpace(friendDiscriminator)
            )
            {
                return BadRequest(
                    new
                    {
                        Type = "error",
                        Message = "Friend name and discriminator must be provided.",
                    }
                );
            }

            var result = await AddFriend(UserId!, friendName, friendDiscriminator);

            if (result.IsSuccess)
            {
                return Ok(new { Type = "success", Message = result.Message });
            }
            else
            {
                return BadRequest(new { Type = "error", Message = result.Message });
            }
        }

        private readonly AppDbContext _dbContext;

        public FriendController(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        [NonAction]
        public async Task<List<PublicUser>> GetFriendsStatus(string userId)
        {
            var publicFriends = await _dbContext
                .Friends.Where(f => f.UserId == userId && f.Status == FriendStatus.Accepted)
                .Join(
                    _dbContext.Users,
                    friend => friend.FriendId,
                    user => user.UserId,
                    (friend, user) => user.GetPublicUser()
                )
                .ToListAsync();

            return publicFriends;
        }

        private async Task<List<FriendDto>> GetFriends(string userId)
        {
            var friends = await _dbContext
                .Friends.Where(f => f.UserId == userId || f.FriendId == userId)
                .Select(f => new
                {
                    FriendId = f.UserId == userId ? f.FriendId : f.UserId,
                    Status = f.Status,
                })
                .ToListAsync();

            var friendIds = friends.Select(fr => fr.FriendId).ToList();

            var friendDetails = await _dbContext
                .Users.Where(u => friendIds.Contains(u.UserId))
                .ToDictionaryAsync(u => u.UserId, u => u);

            var result = friends
                .Select(fr =>
                {
                    if (
                        !friendDetails.TryGetValue(fr.FriendId, out var userDetails)
                        || userDetails == null
                    )
                    {
                        throw new InvalidOperationException(
                            $"User details for FriendId {fr.FriendId} not found."
                        );
                    }

                    return new FriendDto
                    {
                        UserId = fr.FriendId,
                        Nickname = userDetails.Nickname,
                        Discriminator = userDetails.Discriminator,
                        Status = fr.Status,
                    };
                })
                .ToList();

            return result;
        }

        private async Task<Result> AddFriend(
            string userId,
            string friendName,
            string friendDiscriminator
        )
        {
            var friend = await _dbContext
                .Users.Where(u =>
                    u.Nickname == friendName && u.Discriminator == friendDiscriminator
                )
                .Select(u => new { u.UserId, u.Nickname })
                .FirstOrDefaultAsync();

            if (friend == null)
                return Result.Failure("Friend not found.");

            if (friend.UserId == userId)
                return Result.Failure("You cannot add yourself as a friend.");

            var existingFriendship = await _dbContext.Friends.AnyAsync(f =>
                (f.UserId == userId && f.FriendId == friend.UserId)
                || (f.UserId == friend.UserId && f.FriendId == userId)
            );

            if (existingFriendship)
                return Result.Failure("You are already friends with this user.");

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

                return Result.Success("Friend request sent.");
            }
        }
    }
}

public class FriendDto
{
    public required string UserId { get; set; }
    public required string Nickname { get; set; }
    public required string Discriminator { get; set; }
    public FriendStatus Status { get; set; }
}

public class Result
{
    public bool IsSuccess { get; set; }
    public required string Message { get; set; }

    public static Result Success(string message) =>
        new Result { IsSuccess = true, Message = message };

    public static Result Failure(string message) =>
        new Result { IsSuccess = false, Message = message };
}
