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
        private readonly RedisEventEmitter _redisEventEmitter;
        private readonly FriendDmService _friendDmService;

        public FriendController(AppDbContext dbContext, RedisEventEmitter redisEventEmitter, FriendDmService friendDmService)
        {
            _dbContext = dbContext;
            _redisEventEmitter = redisEventEmitter;
            _friendDmService = friendDmService;
        }

        [HttpGet]
        public async Task<IActionResult> GetFriendEndpoint()
        {
            if (string.IsNullOrEmpty(UserId))
                return Unauthorized("User ID is missing.");

            var friends = await GetFriends(UserId);
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


            var existingFriendship = await _dbContext.CheckFriendship(UserId!, friendId);
            if (existingFriendship)
            {
                return Conflict();
            }

            await CreateFriendship(UserId!, friendId, user);

            var friendPublicData = await GetFriendWithStatus(UserId!, friendId, false);
            return Ok(CreateFriendResponse(
                FRIEND_EVENTS.ADD_FRIEND,
                friend,
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

            await CreateFriendship(UserId!, friend.UserId, user);

            return Ok(CreateFriendResponse(
                FRIEND_EVENTS.ADD_FRIEND,
                user));
        }
        [HttpDelete("deny/{friendId}")]
        public async Task<IActionResult> DenyFriend([FromRoute][UserIdLengthValidation] string friendId)
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
                var broadcast = CreateFriendResponse(
                    FRIEND_EVENTS.DENY_FRIEND,
                    user);

                await _redisEventEmitter.EmitToUser(EventType.DENY_FRIEND, broadcast, friendId);

                _dbContext.Friends.Remove(friendship);
                await _dbContext.SaveChangesAsync();

                return Ok(CreateFriendResponse(
                    FRIEND_EVENTS.DENY_FRIEND,
                    friend));
            }

            return Conflict();
        }


        [HttpPut("accept/{friendId}")]
        public async Task<IActionResult> AcceptFriendRequest([FromRoute][UserIdLengthValidation] string friendId)
        {
            var userId = UserId!;
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == userId);
            var friend = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == friendId);

            if (user == null)
                return Unauthorized();

            if (friend == null)
                return NotFound();

            var userPublicData = await GetFriendWithStatus(friend.UserId, userId!, false);

            var friendship = await _dbContext
                .Friends.FirstOrDefaultAsync(f => f.UserId == friendId && f.FriendId == UserId && f.Status == FriendStatus.Pending);

            if (friendship == null)
                return NotFound();

            var broadcast = CreateFriendResponse(
                FRIEND_EVENTS.ACCEPT_FRIEND,
                user,
                userPublicData);

            await _redisEventEmitter.EmitToUser(EventType.ACCEPT_FRIEND, broadcast, friendId);

            friendship.Status = FriendStatus.Accepted;
            var reverseFriendship = new Friend
            {
                UserId = userId!,
                FriendId = friendId,
                Status = FriendStatus.Accepted,
            };

            _dbContext.Friends.Add(reverseFriendship);
            await _dbContext.SaveChangesAsync();

            await _friendDmService.AddDmBetweenUsers(userId, friendId);

            var friendPublicData = await GetFriendWithStatus(userId!, friend.UserId, false);

            return Ok(CreateFriendResponse(
                FRIEND_EVENTS.ACCEPT_FRIEND,
                friend,
                friendPublicData));
        }

        [HttpDelete("{friendId}")]
        public async Task<IActionResult> RemoveFriend([FromRoute][UserIdLengthValidation] string friendId)
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

            var broadcast = CreateFriendResponse(
                FRIEND_EVENTS.REMOVE_FRIEND,
                user);
            await _redisEventEmitter.EmitToUser(EventType.REMOVE_FRIEND, broadcast, friendId);
            _dbContext.Friends.RemoveRange(friendships);


            await _dbContext.SaveChangesAsync();
            var response = CreateFriendResponse(
                FRIEND_EVENTS.REMOVE_FRIEND,
                friend);

            return Ok(response);
        }


        private FriendResponse CreateFriendResponse(
            FRIEND_EVENTS type,
            User user,
            object? friendPublicData = null)
        {
            return new FriendResponse
            {
                FriendId = user.UserId,
                FriendNick = user.Nickname,
                FriendData = friendPublicData,
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

        private async Task CreateFriendship(string userId, string friendUserId, User user)
        {

            var newFriendship = new Friend
            {
                UserId = userId,
                FriendId = friendUserId,
                Status = FriendStatus.Pending,
            };

            _dbContext.Friends.Add(newFriendship);
            await _dbContext.SaveChangesAsync();

            var friendPublicData = await GetFriendWithStatus(friendUserId, userId, false);
            var response = CreateFriendResponse(FRIEND_EVENTS.ADD_FRIEND, user, friendPublicData);
            await _redisEventEmitter.EmitToUser(EventType.ADD_FRIEND, response, friendUserId);


        }



        [NonAction]
        public async Task<PublicUserWithFriendData?> GetFriendWithStatus(string userId, string friendId, bool isSender)
        {
            var friendshipQuery = _dbContext.Friends
                .Where(f => (f.UserId == userId && f.FriendId == friendId) ||
                            (f.UserId == friendId && f.FriendId == userId));

            var user = await _dbContext.Users
                .Where(u => u.UserId == friendId)
                .Select(user => new PublicUserWithFriendData
                {
                    UserId = user.UserId,
                    NickName = user.Nickname,
                    Discriminator = user.Discriminator,
                    CreatedAt = user.CreatedAt,
                    Description = user.Description,
                    SocialMediaLinks = user.SocialMediaLinks,
                    FriendshipStatus = friendshipQuery.Select(f => f.Status).FirstOrDefault(),
                    IsPending = true,
                    IsFriendsRequestToUser = isSender
                        ? friendshipQuery.Any(fr => fr.UserId == userId && fr.FriendId == friendId)
                        : friendshipQuery.Any(fr => fr.UserId == friendId && fr.FriendId == userId)
                })
                .FirstOrDefaultAsync();

            return user;
        }


        [NonAction]
        public async Task<List<PublicUserWithFriendData?>> GetFriends(string userId)
        {
            var friends = await _dbContext
                .Friends.Where(f =>
                    (f.UserId == userId || f.FriendId == userId)
                    && (f.Status == FriendStatus.Accepted || f.Status == FriendStatus.Pending)
                )
                .Select(f => new
                {
                    f.UserId,
                    f.FriendId,
                    f.Status,
                    Friend = f.UserId == userId ? f.FriendId : f.UserId
                })
                .Join(
                    _dbContext.Users,
                    f => f.Friend,
                    user => user.UserId,
                    (f, user) => new PublicUserWithFriendData
                    {
                        UserId = user.UserId,
                        NickName = user.Nickname,
                        Discriminator = user.Discriminator,
                        CreatedAt = user.CreatedAt,
                        Description = user.Description,
                        SocialMediaLinks = user.SocialMediaLinks,
                        FriendshipStatus = f.Status,
                        IsPending = f.Status == FriendStatus.Pending,
                        IsFriendsRequestToUser = _dbContext.Friends.Any(fr =>
                            fr.UserId == user.UserId
                            && fr.FriendId == userId
                            && fr.Status == FriendStatus.Pending
                        )
                    }
                )
                .GroupBy(u => u.UserId)
                .Select(g => g.FirstOrDefault())
                .ToListAsync();

            return friends;
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

    public required string FriendId { get; set; }
    public required string FriendNick { get; set; }
    public object? FriendData { get; set; }
    public bool IsSuccess { get; set; }
    public required string Type { get; set; }
}
