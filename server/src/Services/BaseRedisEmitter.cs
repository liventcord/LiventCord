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
    private readonly ILogger _logger;

    private static SemaphoreSlim? _connectionSemaphore;

    public BaseRedisEmitter(IConfiguration configuration, ILoggerFactory loggerFactory)
    {
        redisConnectionString = configuration["AppSettings:RedisConnectionString"];

        if (string.IsNullOrEmpty(redisConnectionString))
        {
            redisConnectionString = defaultRedisConnectionString;
        }

        int connectionLimit = configuration.GetValue<int>("AppSettings:RedisConnectionLimit", 1);
        _connectionSemaphore = new SemaphoreSlim(connectionLimit);
        _logger = loggerFactory.CreateLogger("Redis");
        Task.Run(ConnectToRedisAsync);
    }
    private static int failedAttempts = 0;
    private const int MaxFailedAttemptsBeforeSuppressingLogs = 3;

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

                    ConfigurationOptions config;
                    if (redisConnectionString.StartsWith("redis://", StringComparison.OrdinalIgnoreCase) || redisConnectionString.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
                    {
                        var uri = new Uri(redisConnectionString);
                        var userInfoParts = uri.UserInfo?.Split(':', 2);
                        config = new ConfigurationOptions
                        {
                            EndPoints = { { uri.Host, uri.Port > 0 ? uri.Port : 6379 } },
                            User = userInfoParts?.Length > 0 ? userInfoParts[0] : null,
                            Password = userInfoParts?.Length > 1 ? userInfoParts[1] : null,
                            Ssl = uri.Scheme == "rediss",
                            AbortOnConnectFail = false
                        };
                    }
                    else
                    {
                        config = ConfigurationOptions.Parse(redisConnectionString);
                        config.Ssl = true;
                        config.AbortOnConnectFail = false;
                    }

                    redis = await ConnectionMultiplexer.ConnectAsync(config);

                    if (redis.IsConnected)
                    {
                        db = redis.GetDatabase();
                        _logger.LogInformation("Connected to Redis.");
                        return;
                    }
                    else
                    {
                        throw new InvalidOperationException("Failed to connect to Redis.");
                    }
                }
                catch (Exception ex)
                {
                    attempt++;
                    int delay = Math.Min(InitialDelayMilliseconds * attempt, MaxBackoffMilliseconds);

                    if (failedAttempts < MaxFailedAttemptsBeforeSuppressingLogs)
                    {
                        _logger.LogError($"Error: {ex.Message}. Retrying in {delay}ms...");
                    }

                    failedAttempts++;

                    await Task.Delay(delay, _cts.Token);
                }
            }

            if (failedAttempts < MaxFailedAttemptsBeforeSuppressingLogs)
            {
                _logger.LogError("Max retries reached. Could not connect to Redis.");
            }
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
            _logger.LogError("Redis connection is not available. Retrying connection...");
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

                _logger.LogInformation($"Guild memberships for {guildId} published to Redis.");
            }
            finally
            {
                _connectionSemaphore.Release();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error publishing guild memberships to Redis: {ex.Message}. Retrying...");
            await ConnectToRedisAsync();
        }
    }
    public async Task EmitToRedisStream(string[] userIds, EventType eventType, object message)
    {
        if (_connectionSemaphore == null) return;
        if (userIds.Length == 0) return;

        if (redis == null || db == null)
        {
            _logger.LogError("Redis connection is not available. Retrying connection...");
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
                    var batch = db.CreateBatch();

                    var addTask = batch.StreamAddAsync(streamKey, streamMessage);
                    var expireTask = batch.KeyExpireAsync(streamKey, TimeSpan.FromMinutes(5));

                    batch.Execute();

                    await Task.WhenAll(addTask, expireTask);

                    _logger.LogInformation($"Event of type '{eventType}' published to Redis stream for {userIds.Length} users.");
                }

                _logger.LogInformation($"Event of type {eventType} published to Redis stream for {userIds.Length} users.");
            }
            finally
            {
                _connectionSemaphore.Release();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error publishing message to Redis: {ex.Message}. Retrying...");
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
