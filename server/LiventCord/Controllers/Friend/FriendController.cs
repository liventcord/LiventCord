using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

public enum FRIEND_EVENTS
{
    ADD_FRIEND,
    ACCEPT_FRIEND,
    REMOVE_FRIEND,
    DENY_FRIEND,
}

public static class FriendEventExtensions
{
    private static readonly Dictionary<FRIEND_EVENTS, string> eventStrings = new()
    {
        { FRIEND_EVENTS.ADD_FRIEND, "add_friend" },
        { FRIEND_EVENTS.ACCEPT_FRIEND, "accept_friend" },
        { FRIEND_EVENTS.REMOVE_FRIEND, "remove_friend" },
        { FRIEND_EVENTS.DENY_FRIEND, "deny_friend" },
    };

    public static string ToEventString(this FRIEND_EVENTS eventType) =>
        eventStrings.GetValueOrDefault(eventType, string.Empty);
}

namespace LiventCord.Controllers
{
    [ApiController]
    [Route("api/v1/friends")]
    [Authorize]
    public class FriendController : BaseController
    {
        private readonly AppDbContext _dbContext;
        private readonly RedisEventEmitter _redisEventEmitter;
        private readonly FriendDmService _friendDmService;
        private readonly ICacheService _cacheService;

        public FriendController(
            AppDbContext dbContext,
            RedisEventEmitter redisEventEmitter,
            FriendDmService friendDmService,
            ICacheService cacheService
        )
        {
            _dbContext = dbContext;
            _redisEventEmitter = redisEventEmitter;
            _friendDmService = friendDmService;
            _cacheService = cacheService;
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
        public async Task<IActionResult> SendFriendIdRequest(
            [FromRoute][UserIdLengthValidation] string friendId
        )
        {
            var userId = UserId!;

            var friend = await _dbContext.Users.FindAsync(friendId);
            if (friend == null)
                return NotFound();

            var existingFriendship = await _dbContext.CheckFriendship(userId, friendId);
            if (existingFriendship)
                return Conflict();

            await CreateFriendship(userId, friendId);

            var friendPublicData = await GetFriendWithStatus(userId, friendId, false);
            return Ok(CreateFriendResponse(FRIEND_EVENTS.ADD_FRIEND, friend.ToIdentity(), friendPublicData));
        }
        [HttpPost]
        public async Task<IActionResult> SendFriendRequest([FromBody] SendFriendRequest request)
        {
            var userId = UserId!;

            var friend = await FindUserByFriendDetails(request.FriendName, request.FriendDiscriminator);
            if (friend == null)
                return NotFound();

            var existingFriendship = await _dbContext.CheckFriendship(userId, friend.UserId);
            if (existingFriendship)
                return Conflict();

            await CreateFriendship(userId, friend.UserId);

            return Ok(CreateFriendResponse(FRIEND_EVENTS.ADD_FRIEND, friend.ToIdentity()));
        }

        [HttpDelete("deny/{friendId}")]
        public async Task<IActionResult> DenyFriend(
            [FromRoute][UserIdLengthValidation] string friendId
        )
        {
            var userId = UserId!;

            var friend = await _dbContext.Users.FindAsync(friendId);
            if (friend == null)
                return NotFound();

            var friendship = await _dbContext.Friends.FirstOrDefaultAsync(f =>
                (f.UserId == userId && f.FriendId == friendId)
                || (f.UserId == friendId && f.FriendId == userId)
            );

            if (friendship == null)
                return NotFound();

            if (friendship.Status != FriendStatus.Pending)
                return Conflict();

            var broadcast = CreateFriendResponse(FRIEND_EVENTS.DENY_FRIEND, new UserStub(userId, UserNickname!));
            await _redisEventEmitter.EmitToUser(EventType.DENY_FRIEND, broadcast, friendId);

            _dbContext.Friends.Remove(friendship);
            await _dbContext.SaveChangesAsync();

            try { _cacheService.InvalidateCache(friendId); } catch { }
            try { _cacheService.InvalidateCache(userId); } catch { }

            return Ok(CreateFriendResponse(FRIEND_EVENTS.DENY_FRIEND, friend.ToIdentity()));
        }
        [HttpPatch("accept/{friendId}")]
        public async Task<IActionResult> AcceptFriendRequest(
            [FromRoute][UserIdLengthValidation] string friendId
        )
        {
            var userId = UserId!;

            var friend = await _dbContext.Users.FindAsync(friendId);
            if (friend == null)
                return NotFound();

            var friendship = await _dbContext.Friends.FirstOrDefaultAsync(f =>
                f.UserId == friendId && f.FriendId == userId && f.Status == FriendStatus.Pending
            );

            if (friendship == null)
                return NotFound();

            friendship.Status = FriendStatus.Accepted;
            _dbContext.Friends.Add(new Friend
            {
                UserId = userId,
                FriendId = friendId,
                Status = FriendStatus.Accepted,
            });

            await _dbContext.SaveChangesAsync();
            await _friendDmService.AddDmBetweenUsers(userId, friendId);

            var (userPublicData, friendPublicData) = await GetBothFriendStatuses(userId, friendId);

            var broadcast = CreateFriendResponse(FRIEND_EVENTS.ACCEPT_FRIEND, new UserStub(userId, UserNickname!), userPublicData);
            await _redisEventEmitter.EmitToUser(EventType.ACCEPT_FRIEND, broadcast, friendId);

            try { _cacheService.InvalidateCache(friendId); } catch { }
            try { _cacheService.InvalidateCache(userId); } catch { }

            return Ok(CreateFriendResponse(FRIEND_EVENTS.ACCEPT_FRIEND, friend.ToIdentity(), friendPublicData));
        }
        [HttpDelete("{friendId}")]
        public async Task<IActionResult> RemoveFriend(
            [FromRoute][UserIdLengthValidation] string friendId
        )
        {
            var userId = UserId!;

            var friend = await _dbContext.Users.FindAsync(friendId);
            if (friend == null)
                return NotFound();

            var friendships = await _dbContext.Friends
                .Where(f =>
                    (f.UserId == userId && f.FriendId == friendId)
                    || (f.UserId == friendId && f.FriendId == userId)
                )
                .ToListAsync();

            if (!friendships.Any())
                return NotFound();

            var broadcast = CreateFriendResponse(FRIEND_EVENTS.REMOVE_FRIEND, new UserStub(userId, UserNickname!));
            await _redisEventEmitter.EmitToUser(EventType.REMOVE_FRIEND, broadcast, friendId);

            _dbContext.Friends.RemoveRange(friendships);
            await _dbContext.SaveChangesAsync();

            try { _cacheService.InvalidateCache(friendId); } catch { }
            try { _cacheService.InvalidateCache(userId); } catch { }

            return Ok(CreateFriendResponse(FRIEND_EVENTS.REMOVE_FRIEND, friend.ToIdentity()));
        }
        private FriendResponse CreateFriendResponse(
            FRIEND_EVENTS type,
            IUserIdentity user,
            object? friendPublicData = null
        )
        {
            return new FriendResponse
            {
                FriendId = user.UserId,
                FriendNick = user.Nickname,
                FriendData = friendPublicData,
                IsSuccess = true,
                Type = type.ToEventString(),
            };
        }

        private async Task<User?> FindUserByFriendDetails(string friendName, string friendDiscriminator)
        {
            return await _dbContext.Users
                .Where(u => u.Nickname == friendName && u.Discriminator == friendDiscriminator)
                .FirstOrDefaultAsync();
        }

        private async Task CreateFriendship(string userId, string friendUserId)
        {
            _dbContext.Friends.Add(new Friend
            {
                UserId = userId,
                FriendId = friendUserId,
                Status = FriendStatus.Pending,
            });

            await _dbContext.SaveChangesAsync();

            var friendPublicData = await GetFriendWithStatus(friendUserId, userId, false);
            var response = CreateFriendResponse(FRIEND_EVENTS.ADD_FRIEND, new UserStub(userId, UserNickname!), friendPublicData);
            await _redisEventEmitter.EmitToUser(EventType.ADD_FRIEND, response, friendUserId);

            try { _cacheService.InvalidateCache(friendUserId); } catch { }
            try { _cacheService.InvalidateCache(userId); } catch { }
        }

        [NonAction]
        public async Task<(PublicUserWithFriendData? forFriend, PublicUserWithFriendData? forUser)> GetBothFriendStatuses(
            string userId,
            string friendId
        )
        {
            var forFriend = await GetFriendWithStatus(userId, friendId, false);
            var forUser = await GetFriendWithStatus(friendId, userId, false);
            return (forFriend, forUser);
        }

        [NonAction]
        public Task<PublicUserWithFriendData?> GetFriendWithStatus(
            string userId,
            string friendId,
            bool isSender
        )
        {
            var friendshipQuery = _dbContext.Friends.Where(f =>
                (f.UserId == userId && f.FriendId == friendId)
                || (f.UserId == friendId && f.FriendId == userId)
            );

            return _dbContext.Users
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
                        : friendshipQuery.Any(fr => fr.UserId == friendId && fr.FriendId == userId),
                })
                .FirstOrDefaultAsync();
        }

        [NonAction]
        public async Task<List<PublicUserWithFriendData>> GetFriends(string userId)
        {
            var pendingInboundSenders = (await _dbContext.Friends
                .Where(f => f.FriendId == userId && f.Status == FriendStatus.Pending)
                .Select(f => f.UserId)
                .ToListAsync()).ToHashSet();

            return await _dbContext.Friends
                .Where(f =>
                    (f.UserId == userId || f.FriendId == userId) &&
                    (f.Status == FriendStatus.Accepted || f.Status == FriendStatus.Pending))
                .Select(f => new
                {
                    FriendData = f,
                    FriendId = f.UserId == userId ? f.FriendId : f.UserId
                })
                .Join(
                    _dbContext.Users,
                    f => f.FriendId,
                    user => user.UserId,
                    (f, user) => new { f.FriendData, User = user }
                )
                .Select(fu => new PublicUserWithFriendData
                {
                    UserId = fu.User.UserId,
                    NickName = fu.User.Nickname,
                    Discriminator = fu.User.Discriminator,
                    CreatedAt = fu.User.CreatedAt,
                    Description = fu.User.Description,
                    SocialMediaLinks = fu.User.SocialMediaLinks,
                    ProfileVersion = _dbContext.ProfileFiles
                        .Where(pf => pf.UserId == fu.User.UserId)
                        .OrderByDescending(pf => pf.CreatedAt)
                        .Select(pf => pf.Version)
                        .FirstOrDefault(),
                    FriendshipStatus = fu.FriendData.Status,
                    IsPending = fu.FriendData.Status == FriendStatus.Pending,
                    IsFriendsRequestToUser = pendingInboundSenders.Contains(fu.User.UserId)
                })
                .GroupBy(f => f.UserId)
                .Select(g => g.First())
                .ToListAsync();
        }
    }
}

public record UserStub(string UserId, string Nickname) : IUserIdentity;

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