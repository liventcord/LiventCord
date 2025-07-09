using System.Text.Json;

public interface IAppStatsService
{
    void IncrementServedFiles();
    int ServedFilesSinceStartup { get; }

    void IncrementRespondedRequests();
    int RespondedRequestsSinceStartup { get; }
    void Save();
}

public class AppStatsService : IAppStatsService
{
    private int _servedFilesSinceStartup;
    private int _respondedRequestsSinceStartup;
    private readonly string _filePath;

    public int ServedFilesSinceStartup => _servedFilesSinceStartup;
    public int RespondedRequestsSinceStartup => _respondedRequestsSinceStartup;

    public AppStatsService(string filePath = "appstats.json")
    {
        _filePath = filePath;
        Load();
    }

    public void IncrementServedFiles()
    {
        Interlocked.Increment(ref _servedFilesSinceStartup);
    }

    public void IncrementRespondedRequests()
    {
        Interlocked.Increment(ref _respondedRequestsSinceStartup);
    }

    private void Load()
    {
        if (!File.Exists(_filePath)) return;

        try
        {
            var json = File.ReadAllText(_filePath);
            var data = JsonSerializer.Deserialize<AppStatsData>(json);
            if (data != null)
            {
                _servedFilesSinceStartup = data.ServedFiles;
                _respondedRequestsSinceStartup = data.RespondedRequests;
            }
        }
        catch
        {
        }
    }

    public void Save()
    {
        var data = new AppStatsData
        {
            ServedFiles = _servedFilesSinceStartup,
            RespondedRequests = _respondedRequestsSinceStartup
        };

        var json = JsonSerializer.Serialize(data);
        File.WriteAllText(_filePath, json);
    }

    private class AppStatsData
    {
        public int ServedFiles { get; set; }
        public int RespondedRequests { get; set; }
    }
}
