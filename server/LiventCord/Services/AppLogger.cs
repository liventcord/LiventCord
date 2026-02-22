using LiventCord.Helpers;

public interface IAppLogger<T>
{
    void LogInformation(string message, params object?[] args);
    void LogWarning(string message, params object?[] args);
    void LogWarning(Exception exception, string message, params object?[] args);
    void LogError(string message, params object?[] args);
    void LogError(Exception exception, string message, params object?[] args);
}

public sealed class AppLogger<T> : IAppLogger<T>
{
    private readonly ILogger<T> _logger;

    public AppLogger(ILogger<T> logger)
    {
        _logger = logger;
    }

    public void LogInformation(string message, params object?[] args)
    {
        _logger.LogInformation(message, Sanitize(args));
    }

    public void LogWarning(string message, params object?[] args)
    {
        _logger.LogWarning(message, Sanitize(args));
    }

    public void LogWarning(Exception exception, string message, params object?[] args)
    {
        _logger.LogWarning(exception, message, Sanitize(args));
    }

    public void LogError(string message, params object?[] args)
    {
        _logger.LogError(message, Sanitize(args));
    }

    public void LogError(Exception exception, string message, params object?[] args)
    {
        _logger.LogError(exception, message, Sanitize(args));
    }

    private static object?[] Sanitize(object?[] args)
    {
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] is string s)
                args[i] = Utils.SanitizeLogInput(s);
        }
        return args;
    }
}