using Microsoft.Extensions.Caching.Memory;

public interface ICacheService
{
    bool TryGet(string key, out object value);
    void Set(string key, object value, TimeSpan expiration);
    void InvalidateCache(string key);
    string[] GetCachedUserIds();
    void InvalidateGuildMemberCaches(IEnumerable<string> guildMembers);
}

public class CacheService : ICacheService
{
    private readonly IMemoryCache _memoryCache;
    private readonly HashSet<string> _userKeys;

    public CacheService(IMemoryCache memoryCache)
    {
        _memoryCache = memoryCache;
        _userKeys = new HashSet<string>();
    }

    public bool TryGet(string key, out object value)
    {
        if (_memoryCache.TryGetValue(key, out var cachedValue))
        {
            value = cachedValue!;
            return true;
        }
        value = null!;
        return false;
    }

    public void Set(string key, object value, TimeSpan expiration)
    {
        var options = new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = expiration };
        _memoryCache.Set(key, value, options);

        if (key.StartsWith("UserInitData_"))
        {
            _userKeys.Add(key);
        }
    }

    public void InvalidateCache(string key)
    {
        _memoryCache.Remove(key);

        _userKeys.Remove(key);
    }

    public string[] GetCachedUserIds()
    {
        return _userKeys.ToArray();
    }
    public void InvalidateGuildMemberCaches(IEnumerable<string> memberIds)
    {
        foreach (var memberId in memberIds)
        {
            _memoryCache.Remove($"UserInitData_{memberId}");
        }
    }
}
