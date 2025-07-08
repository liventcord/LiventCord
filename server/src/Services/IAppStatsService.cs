public interface IAppStatsService
{
    int ServedFilesSinceStartup { get; set; }
}

public class AppStatsService : IAppStatsService
{
    public int ServedFilesSinceStartup { get; set; }
}
