using Microsoft.Extensions.Caching.Memory;

public interface ICacheService
{
    bool TryGet(string key, out object value);
    void Set(string key, object value, TimeSpan expiration);
    void InvalidateCache(string key);
}

public class CacheService : ICacheService
{
    private readonly IMemoryCache _memoryCache;

    public CacheService(IMemoryCache memoryCache)
    {
        _memoryCache = memoryCache;
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
    }

    public void InvalidateCache(string userId)
    {
        _memoryCache.Remove($"UserInitData_{userId}");
    }
}
