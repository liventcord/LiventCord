using System.Text.Json;
using StackExchange.Redis;
using MessagePack;
using System.Collections.Concurrent;
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
    private readonly ConcurrentDictionary<string, string[]> _pendingGuildMembers = new();

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
        if (_connectionSemaphore == null || userIds.Length == 0) return;

        _pendingGuildMembers[guildId] = userIds;

        int maxRetries = 5;
        TimeSpan baseDelay = TimeSpan.FromSeconds(1);

        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            try
            {
                if (redis == null || db == null)
                {
                    _logger.LogWarning("Redis connection is not available. Attempting to reconnect...");
                    await ConnectToRedisAsync();
                }

                if (db != null)
                {
                    await _connectionSemaphore.WaitAsync();

                    try
                    {
                        if (_pendingGuildMembers.TryGetValue(guildId, out var members))
                        {
                            var membershipsJson = JsonSerializer.Serialize(members);
                            await db.StringSetAsync($"guild_memberships:{guildId}", membershipsJson, TimeSpan.FromDays(1));
                            _logger.LogInformation($"Guild memberships for {guildId} published to Redis.");

                            _pendingGuildMembers.TryRemove(guildId, out _);
                            return;
                        }
                    }
                    finally
                    {
                        _connectionSemaphore.Release();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Attempt {attempt + 1}: Error publishing guild memberships to Redis: {ex.Message}");
            }

            if (attempt < maxRetries - 1)
            {
                var delay = TimeSpan.FromMilliseconds(baseDelay.TotalMilliseconds * Math.Pow(2, attempt));
                _logger.LogInformation($"Retrying in {delay.TotalSeconds} seconds...");
                await Task.Delay(delay);
            }
        }

        _logger.LogError($"Failed to publish guild memberships for {guildId} after {maxRetries} attempts. Data is buffered in memory.");
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
