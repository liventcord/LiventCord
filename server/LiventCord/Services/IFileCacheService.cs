public interface IFileCacheService
{
    Task ClearProfileFileCacheAsync(string userId);
    Task ClearGuildFileCacheAsync(string guildId);
    void ClearAttachmentFileCache(string fileId);
}