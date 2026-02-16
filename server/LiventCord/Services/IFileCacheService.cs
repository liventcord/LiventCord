public interface IFileCacheService
{
    void ClearProfileFileCache(string userId);
    void ClearGuildFileCache(string guildId);
}