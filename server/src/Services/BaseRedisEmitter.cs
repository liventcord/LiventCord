using System.Text.Json;
using StackExchange.Redis;
using MessagePack;
public class BaseRedisEmitter
{
    private readonly string? redisConnectionString;
    private readonly string streamKey = "event_stream";
    private readonly CancellationTokenSource _cts = new();
    private readonly SemaphoreSlim _reconnectLock = new(1, 1);
    private const int MaxRetries = 1000;
    private const int InitialDelayMilliseconds = 1000;
    private const int MaxBackoffMilliseconds = 30000;

    private IConnectionMultiplexer? redis;
    private IDatabase? db;
    private const string? defaultRedisConnectionString = "localhost:6379";

    private static SemaphoreSlim? _connectionSemaphore;

    public BaseRedisEmitter(IServiceProvider serviceProvider, IConfiguration configuration, ILogger<BaseRedisEmitter> logger)
    {
        redisConnectionString = configuration["AppSettings:RedisConnectionString"];

        if (string.IsNullOrEmpty(redisConnectionString))
        {
            redisConnectionString = defaultRedisConnectionString;
        }

        int connectionLimit = configuration.GetValue<int>("AppSettings:RedisConnectionLimit", 1);
        _connectionSemaphore = new SemaphoreSlim(connectionLimit);

        Task.Run(ConnectToRedisAsync);
    }

    private async Task ConnectToRedisAsync()
    {
        if (string.IsNullOrEmpty(redisConnectionString)) return;
        if (!await _reconnectLock.WaitAsync(0)) return;

        try
        {
            int attempt = 0;
            while (attempt < MaxRetries && !_cts.Token.IsCancellationRequested)
            {
                try
                {
                    redis?.Dispose();

                    var config = ConfigurationOptions.Parse(redisConnectionString);
                    config.AbortOnConnectFail = false;
                    redis = await ConnectionMultiplexer.ConnectAsync(config);
                    db = redis.GetDatabase();
                    Console.WriteLine("Connected to Redis.");
                    return;
                }
                catch (Exception ex)
                {
                    attempt++;
                    int delay = Math.Min(InitialDelayMilliseconds * attempt, MaxBackoffMilliseconds);
                    Console.WriteLine($"Error: {ex.Message}. Retrying in {delay}ms...");
                    await Task.Delay(delay, _cts.Token);
                }
            }

            Console.WriteLine("Max retries reached. Could not connect to Redis.");
        }
        finally
        {
            _reconnectLock.Release();
        }
    }
    public async Task EmitGuildMembersToRedisStream(string guildId, string[] userIds)
    {
        if (_connectionSemaphore == null) return;
        if (userIds.Length == 0) return;

        if (redis == null || db == null)
        {
            Console.WriteLine("Redis connection is not available. Retrying connection...");
            await ConnectToRedisAsync();
            return;
        }

        try
        {
            await _connectionSemaphore.WaitAsync();

            try
            {
                var membershipsKey = $"guild_memberships:{guildId}";
                var membershipsJson = JsonSerializer.Serialize(userIds);

                if (db != null)
                {
                    await db.StringSetAsync(membershipsKey, membershipsJson, TimeSpan.FromDays(1));
                }

                Console.WriteLine($"Guild memberships for {guildId} published to Redis.");
            }
            finally
            {
                _connectionSemaphore.Release();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error publishing guild memberships to Redis: {ex.Message}. Retrying...");
            await ConnectToRedisAsync();
        }
    }
    public async Task EmitToRedisStream(string[] userIds, EventType eventType, object message)
    {
        if (_connectionSemaphore == null) return;
        if (userIds.Length == 0) return;

        if (redis == null || db == null)
        {
            Console.WriteLine("Redis connection is not available. Retrying connection...");
            await ConnectToRedisAsync();
            return;
        }

        try
        {
            await _connectionSemaphore.WaitAsync();

            try
            {
                string payloadJson = JsonSerializer.Serialize(message);
                var eventPayload = new
                {
                    EventType = eventType.ToString(),
                    UserIDs = userIds,
                    Payload = payloadJson
                };

                var messageBytes = MessagePackSerializer.Serialize(eventPayload);

                var streamMessage = new NameValueEntry[] {
                    new NameValueEntry("EventType", eventType.ToString()),
                    new NameValueEntry("UserIDs", JsonSerializer.Serialize(userIds)),
                    new NameValueEntry("Payload", payloadJson)
                };

                if (db != null)
                {
                    await db.StreamAddAsync(streamKey, streamMessage);
                    await db.KeyExpireAsync(streamKey, TimeSpan.FromMinutes(5));
                }

                Console.WriteLine($"Event of type {eventType} published to Redis stream for {userIds.Length} users.");
            }
            finally
            {
                _connectionSemaphore.Release();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error publishing message to Redis: {ex.Message}. Retrying...");
            await ConnectToRedisAsync();
        }
    }
}

public class BackgroundTaskService : IBackgroundTaskService
{
    public void QueueBackgroundWorkItem(Func<CancellationToken, Task> workItem)
    {
        Task.Run(() => ExecuteWorkItemAsync(workItem));
    }

    private async Task ExecuteWorkItemAsync(Func<CancellationToken, Task> workItem)
    {
        var cancellationToken = new CancellationToken();
        try
        {
            await workItem(cancellationToken);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in background task: {ex.Message}");
        }
    }
}

public interface IBackgroundTaskService
{
    void QueueBackgroundWorkItem(Func<CancellationToken, Task> workItem);
}
