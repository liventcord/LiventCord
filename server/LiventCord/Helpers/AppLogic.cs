using System.Security.Claims;
using LiventCord.Controllers;
using LiventCord.Models;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Helpers
{
    public static class SharedAppConfig
    {
        public static string MediaWorkerUrl { get; private set; }
        public static string MediaApiUrl { get; private set; }
        public static string WsUrl { get; private set; }
        public static float MaxAvatarSize { get; private set; }
        public static float MaxAttachmentSize { get; private set; }
        public static string? AdminKey { get; private set; }

        static SharedAppConfig()
        {
            MediaWorkerUrl = "";
            MaxAvatarSize = 3;
            MaxAttachmentSize = 30;
            WsUrl = "ws://localhost:8080";
            MediaApiUrl = "http://localhost:5000";
            AdminKey = "";
        }

        public static void Initialize(IConfiguration configuration)
        {
            MediaWorkerUrl = configuration["AppSettings:MediaWorkerUrl"] ?? MediaWorkerUrl;
            MediaApiUrl = configuration["AppSettings:MediaApiUrl"] ?? MediaApiUrl;
            WsUrl = configuration["AppSettings:WsUrl"] ?? WsUrl;

            MaxAvatarSize = float.TryParse(configuration["AppSettings:MaxAvatarSize"], out var avatarSize)
                ? avatarSize : MaxAvatarSize;

            MaxAttachmentSize = float.TryParse(configuration["AppSettings:MaxAttachmentSize"], out var attachmentSize)
                ? attachmentSize : MaxAttachmentSize;

            AdminKey = configuration["AppSettings:AdminKey"];
        }

        public static long GetMaxAttachmentSize() => (long)(MaxAttachmentSize * 1024 * 1024);
        public static long GetMaxAvatarsSize() => (long)(MaxAttachmentSize * 1024 * 1024);
    }

    public class AppLogicService
    {
        private readonly AppDbContext _dbContext;
        private readonly MembersController _membersController;
        private readonly FriendController _friendController;
        private readonly ILogger<AppLogicService> _logger;
        private readonly PermissionsController _permissionsController;
        private readonly ICacheService _cacheService;
        private readonly IServiceScopeFactory _scopeFactory;

        public AppLogicService(
            AppDbContext dbContext,
            FriendController friendController,
            MembersController membersController,
            ILogger<AppLogicService> logger,
            PermissionsController permissionsController,
            ICacheService cacheService,
            IServiceScopeFactory scopeFactory)
        {
            _dbContext = dbContext;
            _friendController = friendController;
            _permissionsController = permissionsController;
            _membersController = membersController;
            _cacheService = cacheService;
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        private static async Task<List<PublicUser>> GetDmUsersFromDbAsync(AppDbContext db, string userId)
        {
            var friendIds = await db.UserDms
                .AsNoTracking()
                .Where(d => d.UserId == userId)
                .Select(d => d.FriendId)
                .Distinct()
                .ToListAsync();

            if (!friendIds.Any()) return new List<PublicUser>();

            var users = await db.Users
                .AsNoTracking()
                .Where(u => friendIds.Contains(u.UserId))
                .ToListAsync();

            var profileVersions = await db.ProfileFiles
                .AsNoTracking()
                .Where(pf => friendIds.Contains(pf.UserId))
                .GroupBy(pf => pf.UserId)
                .Select(g => new
                {
                    UserId = g.Key,
                    LatestVersion = g.OrderByDescending(pf => pf.CreatedAt).Select(pf => pf.Version).FirstOrDefault()
                })
                .ToListAsync();

            var versionMap = profileVersions.ToDictionary(p => p.UserId, p => p.LatestVersion ?? null);

            return users
                .Select(u =>
                {
                    var pu = u.GetPublicUser();
                    pu.ProfileVersion = versionMap.GetValueOrDefault(u.UserId, null);
                    return pu;
                })
                .GroupBy(u => u.UserId)
                .Select(g => g.First())
                .ToList();
        }

        public Task<List<PublicUser>> GetDmUsers(string userId) =>
            GetDmUsersFromDbAsync(_dbContext, userId);


        public async Task HandleInitRequest(HttpContext context)
        {
            async Task RejectStaleSession() =>
                await context.Response.WriteAsJsonAsync(
                    new { message = "User session is no longer valid. Please log in again." });

            try
            {
                string? userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    await RejectStaleSession();
                    return;
                }

                var cacheKey = $"UserInitData_{userId}";
                if (_cacheService.TryGet(cacheKey, out var cachedData))
                {
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsJsonAsync(cachedData);
                    return;
                }

                var userTask = Task.Run(async () =>
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    return await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId);
                });

                var guildsTask = Task.Run(async () =>
                {
                    using var scope = _scopeFactory.CreateScope();
                    var membersCtrl = scope.ServiceProvider.GetRequiredService<MembersController>();
                    return await membersCtrl.GetUserGuilds(userId);
                });

                var friendsStatusTask = Task.Run(async () =>
                {
                    using var scope = _scopeFactory.CreateScope();
                    var friendCtrl = scope.ServiceProvider.GetRequiredService<FriendController>();
                    return await friendCtrl.GetFriends(userId);
                });

                var dmFriendsTask = Task.Run(async () =>
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    return await GetDmUsersFromDbAsync(db, userId);
                });

                var permissionsTask = Task.Run(async () =>
                {
                    using var scope = _scopeFactory.CreateScope();
                    var permissionsCtrl = scope.ServiceProvider.GetRequiredService<PermissionsController>();
                    return await permissionsCtrl.GetPermissionsMapForUser(userId);
                });

                var profileAndSharedTask = Task.Run(async () =>
                {
                    await Task.WhenAll(friendsStatusTask, dmFriendsTask, guildsTask);

                    var friendsStatus = friendsStatusTask.Result;
                    var dmFriends = dmFriendsTask.Result;
                    var guilds = guildsTask.Result;

                    var relevantUserIds = friendsStatus.Select(f => f.UserId)
                        .Concat(dmFriends.Select(d => d.UserId))
                        .Append(userId)
                        .Where(id => !string.IsNullOrEmpty(id))
                        .Distinct()
                        .ToList();

                    var profileVersionsTask = Task.Run(async () =>
                    {
                        if (!relevantUserIds.Any()) return new Dictionary<string, string?>();

                        using var scope = _scopeFactory.CreateScope();
                        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                        var versions = await db.ProfileFiles
                            .AsNoTracking()
                            .Where(pf => relevantUserIds.Contains(pf.UserId))
                            .GroupBy(pf => pf.UserId)
                            .Select(g => new
                            {
                                UserId = g.Key,
                                LatestVersion = g.OrderByDescending(pf => pf.CreatedAt)
                                                .Select(pf => pf.Version)
                                                .FirstOrDefault()
                            })
                            .ToListAsync();

                        return versions
                            .Where(p => p.UserId != null)
                            .ToDictionary(p => p.UserId!, p => (string?)p.LatestVersion);
                    });

                    var sharedGuildsTask = Task.Run(async () =>
                    {
                        using var scope = _scopeFactory.CreateScope();
                        var membersCtrl = scope.ServiceProvider.GetRequiredService<MembersController>();
                        return await membersCtrl.GetSharedGuilds(
                            userId,
                            friendsStatus.Cast<PublicUserWithFriendData?>().ToList(),
                            guilds);
                    });

                    await Task.WhenAll(profileVersionsTask, sharedGuildsTask);
                    return (profileVersionsTask.Result, sharedGuildsTask.Result, friendsStatus, dmFriends, guilds);
                });

                await Task.WhenAll(userTask, permissionsTask, profileAndSharedTask);

                var user = userTask.Result;
                if (user == null)
                {
                    await RejectStaleSession();
                    return;
                }

                var (profileVersionMap, sharedGuildsMap, friendsStatus, dmFriends, guilds) = profileAndSharedTask.Result;
                var permissionsMap = permissionsTask.Result;

                var friendsWithVersions = friendsStatus.Select(f =>
                {
                    f.ProfileVersion = ((IReadOnlyDictionary<string?, string?>)profileVersionMap)
                        .GetValueOrDefault(f.UserId);
                    return f;
                }).ToList();

                var dmFriendsWithVersions = dmFriends.Select(d =>
                {
                    d.ProfileVersion = ((IReadOnlyDictionary<string?, string?>)profileVersionMap)
                        .GetValueOrDefault(d.UserId);
                    return d;
                }).ToList();

                var jsonData = new
                {
                    userId,
                    email = user.Email ?? "",
                    nickName = user.Nickname ?? "",
                    userDiscriminator = user.Discriminator ?? "",
                    profileVersion = ((IReadOnlyDictionary<string?, string?>)profileVersionMap)
                        .GetValueOrDefault(userId),
                    sharedGuildsMap,
                    permissionsMap,
                    friendsStatus = friendsWithVersions,
                    dmFriends = dmFriendsWithVersions,
                    guilds,
                    SharedAppConfig.MediaWorkerUrl,
                    SharedAppConfig.MediaApiUrl,
                    maxAvatarSize = SharedAppConfig.MaxAvatarSize,
                    maxAttachmentSize = SharedAppConfig.MaxAttachmentSize,
                    wsUrl = SharedAppConfig.WsUrl,
                };
                _cacheService.Set(cacheKey, jsonData, TimeSpan.FromSeconds(100));

                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(jsonData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while fetching the initial data.");

                if (!context.Response.HasStarted)
                {
                    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                    await context.Response.WriteAsJsonAsync(new { message = "An internal server error occurred." });
                }
            }
        }
    }
}