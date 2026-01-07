using System.Text;
public static class ExampleConfig
{
    private static readonly IConfigurationRoot _config;
    static ExampleConfig()
    {
        var json = @"
        {
        ""Logging"": {
            ""LogLevel"": {
            ""Default"": ""Warning"",
            ""Microsoft.EntityFrameworkCore"": ""Error"",
            ""Microsoft.EntityFrameworkCore.Database.Command"": ""Error""
            }
        },
        ""AllowedHosts"": ""*"",
        ""AppSettings"": {
            ""DatabaseType"": ""sqlite"",
            ""RemoteConnection"": ""Host=localhost;Port=5432;Username=myuser;Password=mypassword;Database=mydatabase;"",
            ""SqlitePath"": ""Data/liventcord.db"",
            ""SqliteCachePath"": ""Data/liventcord_cache.db"",
            ""MinPoolSize"": ""1"",
            ""MaxPoolSize"": ""3"",
            ""Host"": ""0.0.0.0"",
            ""Port"": ""5005"",
            ""FrontendUrl"": ""http://localhost:3000"",
            ""GifWorkerUrl"": ""https://liventcord-gif-worker.efekantunc0.workers.dev"",
            ""MediaWorkerUrl"": ""YOUR_MEDIA_WORKER_URL"",
            ""MaxAvatarSize"": ""3"",
            ""MaxAttachmentsSize"": ""30"",
            ""EnableMetadataIndexing"": true,
            ""MetadataDomainLimit"": ""100"",
            ""JwtKey"": ""YourSuperSecretKeyHereThatShouldBeAtLeast32BytesLong"",
            ""AccessTokenExpiryDays"": 30
        }
        }";

        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));
        _config = new ConfigurationBuilder()
            .AddJsonStream(stream)
            .Build();
    }


    /// <summary>
    /// Get a value from the AppSettings section and convert it to the requested type.
    /// </summary>
    public static T Get<T>(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new ArgumentException("Key cannot be null or empty.", nameof(key));

        var value = _config[$"AppSettings:{key}"];

        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException($"Config value missing: AppSettings:{key}");

        try
        {
            var targetType = Nullable.GetUnderlyingType(typeof(T)) ?? typeof(T);
            return (T)Convert.ChangeType(value, targetType);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"Failed to convert config value '{value}' to type {typeof(T).Name} for key: AppSettings:{key}", ex
            );
        }
    }
}
