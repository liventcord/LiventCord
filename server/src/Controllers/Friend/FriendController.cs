using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
public enum FRIEND_EVENTS
{
    ADD_FRIEND, ACCEPT_FRIEND, REMOVE_FRIEND, DENY_FRIEND
}

public static class FriendEventExtensions
{
    private static readonly Dictionary<FRIEND_EVENTS, string> eventStrings = new()
    {
        { FRIEND_EVENTS.ADD_FRIEND, "add_friend" },
        { FRIEND_EVENTS.ACCEPT_FRIEND, "accept_friend" },
        { FRIEND_EVENTS.REMOVE_FRIEND, "remove_friend" },
        { FRIEND_EVENTS.DENY_FRIEND, "deny_friend" }
    };

    public static string ToEventString(this FRIEND_EVENTS eventType) => eventStrings.GetValueOrDefault(eventType, string.Empty);
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

        [HttpGet]
        public async Task<IActionResult> GetFriendEndpoint()
        {
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized("User ID is missing.");

            var friends = await GetFriendsStatus(UserId);
            return Ok(friends);
        }

        [HttpPost("id/{friendId}")]
        public async Task<IActionResult> SendFriendIdRequest([FromRoute][UserIdLengthValidation] string friendId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == UserId);
            var friend = await FindUser(friendId);

            if (friend == null)
            {
                return NotFound();
            }

            if (user == null)
            {
                return Unauthorized();
            }

            var friendPublicData = await GetFriendWithStatus(UserId!, friendId);

            var existingFriendship = await _dbContext.CheckFriendship(UserId!, friend.UserId);
            if (existingFriendship)
            {
                return Conflict();
            }

            await CreateFriendship(friend.UserId, FriendStatus.Pending);

            return Ok(CreateFriendResponse(
                FRIEND_EVENTS.ADD_FRIEND,
                user,
                friendPublicData));
        }
        [HttpPost]
        public async Task<IActionResult> SendFriendRequest([FromBody] SendFriendRequest request)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == UserId);
            if (user == null)
            {
                return Unauthorized();
            }

            var friend = await FindUserByFriendDetails(request.FriendName, request.FriendDiscriminator);
            if (friend == null)
                return NotFound();

            var existingFriendship = await _dbContext.CheckFriendship(UserId!, friend.UserId);
            if (existingFriendship)
                return Conflict();

            await CreateFriendship(friend.UserId, FriendStatus.Pending);

            return Ok(CreateFriendResponse(
                FRIEND_EVENTS.ADD_FRIEND,
                user));
        }
        [HttpDelete("deny/{friendId}")]
        public async Task<IActionResult> DenyFriend(string friendId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == UserId);
            if (user == null)
                return Unauthorized();

            var friend = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == friendId);
            if (friend == null)
                return NotFound();

            var friendship = await _dbContext.Friends
                .FirstOrDefaultAsync(f => (f.UserId == UserId && f.FriendId == friendId) || (f.UserId == friendId && f.FriendId == UserId));

            if (friendship == null)
                return NotFound();

            if (friendship.Status == FriendStatus.Pending)
            {
                _dbContext.Friends.Remove(friendship);
                await _dbContext.SaveChangesAsync();
                return Ok(new { message = "Friend request denied." });
            }

            return Conflict();
        }


        [HttpPut("accept/{friendId}")]
        public async Task<IActionResult> AcceptFriendRequest(string friendId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == UserId);
            var friend = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == friendId);

            if (user == null)
                return Unauthorized();

            if (friend == null)
                return NotFound();

            var friendPublicData = friend.GetPublicUser();

            var friendship = await _dbContext
                .Friends.FirstOrDefaultAsync(f => f.UserId == friendId && f.FriendId == UserId && f.Status == FriendStatus.Pending);

            if (friendship == null)
                return NotFound();

            friendship.Status = FriendStatus.Accepted;
            var reverseFriendship = new Friend
            {
                UserId = UserId!,
                FriendId = friendId,
                Status = FriendStatus.Accepted,
            };

            _dbContext.Friends.Add(reverseFriendship);
            await _dbContext.SaveChangesAsync();

            return Ok(CreateFriendResponse(
                FRIEND_EVENTS.ACCEPT_FRIEND,
                user,
                friendPublicData));
        }

        [HttpDelete("{friendId}")]
        public async Task<IActionResult> RemoveFriend(string friendId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == UserId);
            var friend = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == friendId);

            if (user == null || friend == null)
                return NotFound();


            var friendships = await _dbContext.Friends
                .Where(f =>
                    (f.UserId == UserId && f.FriendId == friendId) ||
                    (f.UserId == friendId && f.FriendId == UserId)
                )
                .ToListAsync();

            if (!friendships.Any())
                return NotFound();

            _dbContext.Friends.RemoveRange(friendships);
            await _dbContext.SaveChangesAsync();

            return Ok(CreateFriendResponse(
                FRIEND_EVENTS.REMOVE_FRIEND,
                friend));
        }


        private FriendResponse CreateFriendResponse(
            FRIEND_EVENTS type,
            User user,
            object? friendPublicData = null)
        {
            return new FriendResponse
            {
                UserId = user.UserId,
                UserNick = user.Nickname,
                UserData = friendPublicData,
                IsSuccess = true,
                Type = type.ToEventString()
            };
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

        private async Task<User?> FindUser(
            string friendId
        )
        {
            return await _dbContext
                .Users.Where(u =>
                    u.UserId == friendId
                )
                .FirstOrDefaultAsync();
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

            _dbContext.Friends.Add(newFriendship);

            await _dbContext.SaveChangesAsync();
        }

        [NonAction]
        public async Task<List<PublicUserWithStatus>> GetFriendsStatus(string userId)
        {
            var friends = await _dbContext
                .Friends.Where(f =>
                    (f.UserId == userId || f.FriendId == userId)
                    && (f.Status == FriendStatus.Accepted || f.Status == FriendStatus.Pending)
                )
                .Join(
                    _dbContext.Users,
                    friend => friend.UserId == userId ? friend.FriendId : friend.UserId,
                    user => user.UserId,
                    (friend, user) =>
                        new PublicUserWithStatus
                        {
                            UserId = user.UserId,
                            NickName = user.Nickname,
                            Discriminator = user.Discriminator,
                            Status = user.Status,
                            IsOnline = user.IsOnline(),
                            CreatedAt = user.CreatedAt,
                            Description = user.Description,
                            Location = user.Location,
                            SocialMediaLinks = user.SocialMediaLinks,
                            FriendshipStatus = friend.Status,
                            IsPending = friend.Status == FriendStatus.Pending,
                            IsFriendsRequestToUser = _dbContext.Friends.Any(fr =>
                                fr.UserId == user.UserId
                                && fr.FriendId == userId
                                && fr.Status == FriendStatus.Pending
                            )
                        }
                )
                .ToListAsync();

            return friends;
        }

        [NonAction]
        public async Task<List<PublicUserWithStatus>> GetFriendWithStatus(string userId, string friendId)
        {
            var user = await _dbContext.Users
                .Where(u => u.UserId == friendId)
                .Select(user => new PublicUserWithStatus
                {
                    UserId = user.UserId,
                    NickName = user.Nickname,
                    Discriminator = user.Discriminator,
                    Status = user.Status,
                    IsOnline = user.IsOnline(),
                    CreatedAt = user.CreatedAt,
                    Description = user.Description,
                    Location = user.Location,
                    SocialMediaLinks = user.SocialMediaLinks,
                    FriendshipStatus = _dbContext.Friends
                        .Where(f => (f.UserId == userId && f.FriendId == friendId) ||
                            (f.UserId == friendId && f.FriendId == userId))
                        .Select(f => f.Status)
                        .FirstOrDefault(),
                    IsPending = _dbContext.Friends
                        .Any(f => f.Status == FriendStatus.Pending),
                    IsFriendsRequestToUser = _dbContext.Friends
                        .Any(fr => fr.UserId == friendId &&
                            fr.FriendId == userId &&
                            fr.Status == FriendStatus.Pending)
                })
                .ToListAsync();

            return user;
        }

    }

}

public class SendFriendRequest
{
    public required string FriendName { get; set; }
    public required string FriendDiscriminator { get; set; }
}

public class FriendResponse
{
    public required string UserId { get; set; }
    public required string UserNick { get; set; }
    public object? UserData { get; set; }
    public bool IsSuccess { get; set; }
    public required string Type { get; set; }
}
