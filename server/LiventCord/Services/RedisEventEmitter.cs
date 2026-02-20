using LiventCord.Controllers;

public class RedisEventEmitter
{
    private readonly IServiceProvider _serviceProvider;
    private readonly BaseRedisEmitter _redisEmitter;
    private readonly int _maxDegreeOfParallelism;
    private readonly SemaphoreSlim _semaphore;
    private readonly ILogger<RedisEventEmitter> _logger;

    public RedisEventEmitter(IServiceProvider serviceProvider, ILogger<RedisEventEmitter> logger, BaseRedisEmitter redisEmitter, int maxDegreeOfParallelism = 8)
    {
        _serviceProvider = serviceProvider;
        _redisEmitter = redisEmitter;
        _maxDegreeOfParallelism = maxDegreeOfParallelism;
        _semaphore = new SemaphoreSlim(_maxDegreeOfParallelism, _maxDegreeOfParallelism);
        _logger = logger;
    }

    public async Task EmitToGuild(EventType eventType, object payload, string guildId, string userIdToExclude = "")
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userIds = await dbContext.GetGuildUserIds(guildId, userIdToExclude);
        _logger.LogInformation("Emitting event {eventType} to guild {guildId} ", eventType, guildId);

        if (userIds.Any())
            await EmitBatchAsync(userIds, eventType, payload);
    }

    public async Task EmitGuildMembersToRedis(string guildId)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userIds = await dbContext.GetGuildUserIds(guildId, null);

        if (userIds.Any())
            await EmitGuildBatchAsync(guildId, userIds);
    }

    public async Task EmitToFriend(EventType eventType, object payload, string userId, string friendId)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        bool isFriend = await dbContext.CheckFriendship(userId, friendId);
        if (!isFriend) return;

        _logger.LogInformation("Emitting event {eventType} to friend {friendId} ", eventType, friendId);

        await EmitBatchAsync([friendId], eventType, payload);
    }

    public Task EmitToUser(EventType eventType, object payload, string friendId)
    {
        return EmitBatchAsync([friendId], eventType, payload);
    }

    private async Task EmitBatchAsync(IEnumerable<string> userIds, EventType eventType, object payload)
    {
        await _semaphore.WaitAsync();
        try
        {
            await _redisEmitter.EmitToRedisStream(userIds.ToArray(), eventType, payload);
        }
        finally
        {
            _semaphore.Release();
        }
    }

    private async Task EmitGuildBatchAsync(string guildId, IEnumerable<string> userIds)
    {
        await _semaphore.WaitAsync();
        try
        {
            await _redisEmitter.EmitGuildMembersToRedisStream(guildId, userIds.ToArray());
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task EmitGuildsParallel(IEnumerable<string> guildIds, Func<string, Task> emitFunc)
    {
        var options = new ParallelOptions
        {
            MaxDegreeOfParallelism = _maxDegreeOfParallelism
        };

        await Parallel.ForEachAsync(guildIds, options, async (guildId, cancellationToken) =>
        {
            await emitFunc(guildId);
        });
    }
}

public enum EventType
{
    CREATE_CHANNEL,
    JOIN_GUILD,
    GUILD_MEMBER_ADDED,
    GUILD_MEMBER_REMOVED,
    KICK_MEMBER,
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
    EDIT_MESSAGE_GUILD,
    EDIT_MESSAGE_DM,
}

