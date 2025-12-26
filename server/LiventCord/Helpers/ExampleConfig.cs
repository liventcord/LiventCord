using Microsoft.Extensions.Configuration;

public static class ExampleConfig
{
    private static readonly IConfigurationRoot _config;

    static ExampleConfig()
    {
        _config = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("Properties/exampleSettings.json", optional: false, reloadOnChange: true)
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
