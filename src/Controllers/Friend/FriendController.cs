using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
public enum FRIEND_EVENTS
{
    ADD_FRIEND,ACCEPT_FRIEND
}

public static class FriendEventExtensions
{
    private static readonly Dictionary<FRIEND_EVENTS, string> eventStrings = new()
    {
        { FRIEND_EVENTS.ADD_FRIEND, "add_friend" },
        { FRIEND_EVENTS.ACCEPT_FRIEND, "accept_friend" }
    };

    public static string ToString(FRIEND_EVENTS eventType) => eventStrings.GetValueOrDefault(eventType, string.Empty);
}


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

            var friends = await GetFriendsStatus(UserId);
            return Ok(friends);
        }

        [HttpPost("")]
        public async Task<IActionResult> SendFriendRequest([FromBody] SendFriendRequest request)
        {
            var friend = await FindUserByFriendDetails(
                request.FriendName,
                request.FriendDiscriminator
            );
            if (friend == null)
            {
                return NotFound("Friend not found.");
            }

            var existingFriendship = await CheckExistingFriendship(friend.UserId);
            if (existingFriendship)
            {
                return Conflict("You are already friends with this user.");
            }

            await CreateFriendship(friend.UserId, FriendStatus.Pending);

            return Ok(FRIEND_EVENTS.ADD_FRIEND);
        }

        [HttpPut("accept/{friendId}")]
        public async Task<IActionResult> AcceptFriendRequest(string friendId)
        {
            var friendship = await _dbContext
                .Friends.Where(f =>
                    f.UserId == friendId && f.FriendId == UserId && f.Status == FriendStatus.Pending
                )
                .FirstOrDefaultAsync();

            if (friendship == null)
            {
                return NotFound("Friend request not found.");
            }
            if (UserId == null)
            {
                return Unauthorized();
            }

            friendship.Status = FriendStatus.Accepted;

            var reverseFriendship = new Friend
            {
                UserId = UserId,
                FriendId = friendId,
                Status = FriendStatus.Accepted,
            };

            _dbContext.Friends.Add(reverseFriendship);

            await _dbContext.SaveChangesAsync();

            return Ok(FRIEND_EVENTS.ACCEPT_FRIEND);
        }

        [HttpDelete("{friendId}")]
        public async Task<IActionResult> RemoveFriend(string friendId)
        {
            var friendship = await _dbContext.Friends.FirstOrDefaultAsync(f =>
                f.UserId == UserId && f.FriendId == friendId
            );

            if (friendship == null)
            {
                return NotFound("Friendship not found.");
            }

            _dbContext.Friends.Remove(friendship);
            await _dbContext.SaveChangesAsync();

            return Ok("Friend removed.");
        }

        private async Task<User?> FindUserByFriendDetails(
            string friendName,
            string friendDiscriminator
        )
        {
            return await _dbContext
                .Users.Where(u =>
                    u.Nickname == friendName && u.Discriminator == friendDiscriminator
                )
                .FirstOrDefaultAsync();
        }

        private async Task<bool> CheckExistingFriendship(string friendUserId)
        {
            return await _dbContext.Friends.AnyAsync(f =>
                (f.UserId == UserId && f.FriendId == friendUserId)
                || (f.UserId == friendUserId && f.FriendId == UserId)
            );
        }

        private async Task CreateFriendship(string friendUserId, FriendStatus status)
        {
            if (UserId == null)
            {
                return;
            }

            var newFriendship = new Friend
            {
                UserId = UserId,
                FriendId = friendUserId,
                Status = status,
            };

            var reverseFriendship = new Friend
            {
                UserId = friendUserId,
                FriendId = UserId,
                Status = status,
            };

            _dbContext.Friends.Add(newFriendship);
            _dbContext.Friends.Add(reverseFriendship);

            await _dbContext.SaveChangesAsync();
        }

        [NonAction]
        public async Task<List<PublicUserWithStatus>> GetFriendsStatus(string userId)
        {
            var friends = await _dbContext
                .Friends.Where(f =>
                    f.UserId == userId
                    && (f.Status == FriendStatus.Accepted || f.Status == FriendStatus.Pending)
                )
                .Join(
                    _dbContext.Users,
                    friend => friend.FriendId,
                    user => user.UserId,
                    (friend, user) =>
                        new PublicUserWithStatus
                        {
                            PublicUser = user.GetPublicUser(),
                            Status = friend.Status,
                            IsFriendsRequestToUser = _dbContext.Friends.Any(fr =>
                                fr.UserId == userId
                                && fr.FriendId == user.UserId
                                && fr.Status == FriendStatus.Pending
                            ),
                        }
                )
                .ToListAsync();

            return friends;
        }

        public class PublicUserWithStatus
        {
            public required PublicUser PublicUser { get; set; }
            public FriendStatus Status { get; set; }
            public bool IsFriendsRequestToUser { get; set; }
        }
    }
}

public class SendFriendRequest
{
    public required string FriendName { get; set; }
    public required string FriendDiscriminator { get; set; }
}
