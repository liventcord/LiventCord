public class FileCacheService : IFileCacheService
{
    private readonly string _cacheFilePath = "FileCache";
    private string CacheDirectory =>
        Path.Combine(Directory.GetCurrentDirectory(), _cacheFilePath);
    private readonly ILogger<FileCacheService> _logger;

    public FileCacheService(ILogger<FileCacheService> logger)
    {
        _logger = logger;
    }

    public void ClearProfileFileCache(string userId)
    {
        var cachePattern = Path.Combine(CacheDirectory, $"profile_{userId}_*.file");
        var cacheDir = Path.GetDirectoryName(cachePattern);
        var searchPattern = Path.GetFileName(cachePattern);

        if (!Directory.Exists(cacheDir))
            return;

        var matchingFiles = Directory.GetFiles(cacheDir, searchPattern);
        foreach (var file in matchingFiles)
        {
            try
            {
                System.IO.File.Delete(file);
                var metaFile = file + ".meta";
                if (System.IO.File.Exists(metaFile))
                    System.IO.File.Delete(metaFile);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete cached file: {FilePath}", file);
            }
        }
    }

    public void ClearGuildFileCache(string guildId)
    {
        var cachePattern = Path.Combine(CacheDirectory, $"guild_{guildId}_*.file");
        var cacheDir = Path.GetDirectoryName(cachePattern);
        var searchPattern = Path.GetFileName(cachePattern);

        if (!Directory.Exists(cacheDir))
            return;

        var matchingFiles = Directory.GetFiles(cacheDir, searchPattern);
        foreach (var file in matchingFiles)
        {
            try
            {
                System.IO.File.Delete(file);
                var metaFile = file + ".meta";
                if (System.IO.File.Exists(metaFile))
                    System.IO.File.Delete(metaFile);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete cached file: {FilePath}", file);
            }
        }
    }
}