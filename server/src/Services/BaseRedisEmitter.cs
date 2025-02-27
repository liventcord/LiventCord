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

    public BaseRedisEmitter(IServiceProvider serviceProvider, IConfiguration configuration, ILogger<BaseRedisEmitter> logger)
    {
        redisConnectionString = configuration["AppSettings:RedisConnectionString"];

        if (string.IsNullOrEmpty(redisConnectionString))
        {
            redisConnectionString = defaultRedisConnectionString;
        }

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

    public async Task EmitToRedisStream(string[] userIds, EventType eventType, object message)
    {
        if (userIds.Length == 0) return;

        if (redis == null || db == null)
        {
            Console.WriteLine("Redis connection is not available. Retrying connection...");
            await ConnectToRedisAsync();
            return;
        }

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

            var streamMessage = new NameValueEntry[]
            {
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
        catch (Exception ex)
        {
            Console.WriteLine($"Error publishing message to Redis: {ex.Message}. Retrying...");
            await ConnectToRedisAsync();
        }
    }


}
