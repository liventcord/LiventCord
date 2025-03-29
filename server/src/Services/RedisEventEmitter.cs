using LiventCord.Controllers;

public class RedisEventEmitter
{
    private readonly IBackgroundTaskService _backgroundTaskService;
    private readonly IServiceProvider _serviceProvider;
    private readonly BaseRedisEmitter _redisEmitter;

    public RedisEventEmitter(IBackgroundTaskService backgroundTaskService, IServiceProvider serviceProvider, BaseRedisEmitter redisEmitter)
    {
        _backgroundTaskService = backgroundTaskService;
        _serviceProvider = serviceProvider;
        _redisEmitter = redisEmitter;
    }

    public async Task EmitToGuild(EventType eventType, object payload, string guildId, string userId)
    {
        Console.WriteLine(eventType.ToString(), payload, guildId, userId);
        using (var scope = _serviceProvider.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userIds = await dbContext.GetGuildUserIds(guildId, userId);

            _backgroundTaskService.QueueBackgroundWorkItem(async token =>
            {
                await _redisEmitter.EmitToRedisStream(userIds, eventType, payload);
            });
        }
    }
    public async Task EmitGuildMembersToRedis(string guildId)
    {
        using (var scope = _serviceProvider.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userIds = await dbContext.GetGuildUserIds(guildId, null);

            _backgroundTaskService.QueueBackgroundWorkItem(async token =>
            {
                await _redisEmitter.EmitGuildMembersToRedisStream(guildId, userIds);
            });
        }
    }

    public async Task EmitToFriend(EventType eventType, object payload, string userId, string friendId)
    {
        using (var scope = _serviceProvider.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            bool isFriend = await dbContext.CheckFriendship(userId, friendId);
            string[] userIds = { friendId };

            _backgroundTaskService.QueueBackgroundWorkItem(async token =>
            {
                await _redisEmitter.EmitToRedisStream(userIds, eventType, payload);
            });
        }
    }
    public Task EmitToUser(EventType eventType, object payload, string friendId)
    {
        string[] userIds = { friendId };

        _backgroundTaskService.QueueBackgroundWorkItem(async token =>
        {
            await _redisEmitter.EmitToRedisStream(userIds, eventType, payload);
        });

        return Task.CompletedTask;
    }

}

public enum EventType
{
    CREATE_CHANNEL,
    JOIN_GUILD,
    LEAVE_GUILD,
    DELETE_GUILD,
    DELETE_GUILD_IMAGE,
    SEND_MESSAGE_GUILD,
    SEND_MESSAGE_DM,
    DELETE_MESSAGE_DM,
    DELETE_MESSAGE_GUILD,
    UPDATE_GUILD_NAME,
    UPDATE_GUILD_IMAGE,
    DELETE_CHANNEL,
    START_TYPING,
    STOP_TYPING,
    ADD_FRIEND,
    ACCEPT_FRIEND,
    REMOVE_FRIEND,
    DENY_FRIEND,
    CHANGE_NICK,
    LEAVE_VOICE_CHANNEL,
    JOIN_VOICE_CHANNEL,
    CHANGE_GUILD_NAME,
    UPDATE_CHANNEL_NAME,
    UPDATE_MESSAGE
}