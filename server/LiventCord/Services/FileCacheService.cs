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

    public Task ClearProfileFileCacheAsync(string userId)
    {
        var pattern = $"profile_{userId}_*.file";
        return ClearByPatternAsync(pattern);
    }

    public Task ClearGuildFileCacheAsync(string guildId)
    {
        var pattern = $"guild_{guildId}_*.file";
        return ClearByPatternAsync(pattern);
    }

    public void ClearAttachmentFileCache(string fileId)
    {
        var pattern = $"{fileId}_*.file";

        _ = Task.Run(async () =>
        {
            try
            {
                await ClearByPatternAsync(pattern);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Fire-and-forget attachment cache clear failed for {FileId}", fileId);
            }
        });
    }

    private Task ClearByPatternAsync(string searchPattern)
    {
        return Task.Run(() =>
        {
            if (!Directory.Exists(CacheDirectory))
                return;

            string[] files;
            try
            {
                files = Directory.GetFiles(CacheDirectory, searchPattern);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to enumerate cache files with pattern {Pattern}", searchPattern);
                return;
            }

            Parallel.ForEach(files, file =>
            {
                try
                {
                    File.Delete(file);

                    var metaFile = file + ".meta";
                    if (File.Exists(metaFile))
                        File.Delete(metaFile);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete cached file: {FilePath}", file);
                }
            });
        });
    }
}