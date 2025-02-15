
public class MediaStorageInitializer
{
    private readonly long _storageLimitBytes;

    private readonly MediaCacheSettings _mediaCacheSettings;

    public MediaStorageInitializer(MediaCacheSettings mediaCacheSettings, IConfiguration configuration)
    {
        _mediaCacheSettings = mediaCacheSettings;


        _storageLimitBytes = long.TryParse(configuration["AppSettings:ExternalMediaLimit"], out var limit)
            ? limit * 1024 * 1024 * 1024
            : 10L * 1024 * 1024 * 1024;
    }

    public void Initialize()
    {
        if (!Directory.Exists(_mediaCacheSettings.CacheDirectory))
            Directory.CreateDirectory(_mediaCacheSettings.CacheDirectory);

        ReportStorageStatus();
    }


    private long GetFolderSize(string folderPath)
    {
        long totalSize = 0;
        var files = Directory.GetFiles(folderPath, "*", SearchOption.AllDirectories);
        foreach (var file in files)
        {
            FileInfo fileInfo = new FileInfo(file);
            totalSize += fileInfo.Length;
        }
        return totalSize;
    }


    private void ReportStorageStatus()
    {
        var folderSize = GetFolderSize(_mediaCacheSettings.CacheDirectory);
        var limitInGB = _storageLimitBytes / (1024 * 1024 * 1024);
        var folderSizeInGB = folderSize / (1024 * 1024 * 1024);

        var limitReached = folderSizeInGB >= limitInGB;
        var barLength = 40;
        var filledLength = (int)(barLength * folderSizeInGB / limitInGB);
        var emptyLength = barLength - filledLength;

        string progressBar = new string('=', filledLength) + new string('-', emptyLength);

        Console.WriteLine($"External media storage folder size: {folderSizeInGB} GB / {limitInGB} GB");
        Console.WriteLine($"[{progressBar}]");
        if (limitReached)
        {
            Console.WriteLine("Warning: Storage limit reached or exceeded.");
        }
    }
}

public class MediaCacheSettings
{
    public string CacheDirectory { get; }

    public MediaCacheSettings()
    {
        CacheDirectory = Path.Combine(Directory.GetCurrentDirectory(), "MediaCache");
    }
}

