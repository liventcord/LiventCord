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

        private readonly AppDbContext _dbContext;

        public FriendController(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        [HttpGet("")]
        public async Task<IActionResult> GetFriendEndpoint()
        {
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized("User ID is missing.");

            var friends = await GetFriends(UserId);
            return Ok(friends);
        }
        [HttpPost("")]
        public async Task<IActionResult> AddFriendEndpoint([FromBody] AddFriendRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.FriendName) || string.IsNullOrWhiteSpace(request.FriendDiscriminator))
            {
                return BadRequest(new { Code = "ERR_INVALID_INPUT" });
            }

            var result = await AddFriend(UserId!, request.FriendName, request.FriendDiscriminator);

            if (result.IsSuccess)
            {
                return Ok(new { Code = result.Message });
            }
            else if (result.Message == "ERR_USER_NOT_FOUND")
            {
                return NotFound(new { Code = result.Message });
            }
            else
            {
                return BadRequest(new { Code = result.Message });
            }
        }

        private async Task<Result> AddFriend(string userId, string friendName, string friendDiscriminator)
        {
            var friend = await _dbContext.Users
                .Where(u => u.Nickname == friendName && u.Discriminator == friendDiscriminator)
                .Select(u => new { u.UserId, u.Nickname })
                .FirstOrDefaultAsync();

            if (friend == null)
                return Result.Failure("ERR_USER_NOT_FOUND");

            if (friend.UserId == userId)
                return Result.Failure("ERR_CANNOT_ADD_SELF");

            var existingFriendship = await _dbContext.Friends.AnyAsync(f =>
                (f.UserId == userId && f.FriendId == friend.UserId) ||
                (f.UserId == friend.UserId && f.FriendId == userId)
            );

            if (existingFriendship)
                return Result.Failure("ERR_ALREADY_FRIENDS");

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

                return Result.Success("SUCCESS_REQUEST_SENT");
            }
        }




        [NonAction]
        public async Task<List<PublicUserWithStatus>> GetFriendsStatus(string userId)
        {
            var friends = await _dbContext
                .Friends
                .Where(f => f.UserId == userId && (f.Status == FriendStatus.Accepted || f.Status == FriendStatus.Pending))
                .Join(
                    _dbContext.Users,
                    friend => friend.FriendId,
                    user => user.UserId,
                    (friend, user) => new PublicUserWithStatus
                    {
                        PublicUser = user.GetPublicUser(),
                        Status = friend.Status
                    }
                )
                .ToListAsync();

            return friends;
        }
        public class PublicUserWithStatus
        {
            public required PublicUser PublicUser { get; set; }
            public FriendStatus Status { get; set; }
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
    }

        
}
public class AddFriendRequest
{
    public required string FriendName { get; set; }
    public required string FriendDiscriminator { get; set; }
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
