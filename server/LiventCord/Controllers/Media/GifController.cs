using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;

[ApiController]
[Route("api/v1/gifs")]
public class GifController : ControllerBase
{
    private readonly IMemoryCache _cache;
    private readonly string _tenorApiKey;
    private readonly string _giphyApiKey;

    public GifController(IMemoryCache cache, IConfiguration configuration)
    {
        _cache = cache;
        _tenorApiKey = configuration["AppSettings:TenorApiKey"] ?? "";
        _giphyApiKey = configuration["AppSettings:GiphyApiKey"] ?? "";
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery(Name = "q")] string q, [FromQuery] int limit)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest(new { error = "URL parameter \"q\" is missing" });

        string body;
        var cacheKey = $"gifs:{q}";
        if (_cache.TryGetValue(cacheKey, out string? cachedJson))
        {
            if (cachedJson != null)
                return Content(cachedJson, "application/json");
        }

        try
        {
            using var client = new HttpClient();
            List<object> normalizedResults = new List<object>();

            if (!string.IsNullOrWhiteSpace(_tenorApiKey))
            {
                var queryParams = new Dictionary<string, string?>
                {
                    ["q"] = q,
                    ["key"] = _tenorApiKey,
                    ["client_key"] = "my_test_app",
                    ["limit"] = "50"
                };
                var url = QueryHelpers.AddQueryString("https://tenor.googleapis.com/v2/search", queryParams);
                using var resp = await client.GetAsync(url);
                var respBody = await resp.Content.ReadAsStringAsync();
                if (!resp.IsSuccessStatusCode)
                    return StatusCode(502, new { error = $"Upstream HTTP error: {resp.StatusCode}" });

                var json = JsonDocument.Parse(respBody);
                if (json.RootElement.TryGetProperty("results", out var results))
                {
                    foreach (var item in results.EnumerateArray())
                    {
                        normalizedResults.Add(item);
                    }
                }
            }
            else if (!string.IsNullOrWhiteSpace(_giphyApiKey))
            {
                const int gifLimit = 200;
                if (limit > gifLimit) limit = gifLimit;
                int pageSize = 50;
                var allResults = new List<JsonElement>();

                for (int offset = 0; offset < limit; offset += pageSize)
                {
                    var queryParams = new Dictionary<string, string?>
                    {
                        ["api_key"] = _giphyApiKey,
                        ["q"] = q,
                        ["limit"] = pageSize.ToString(),
                        ["offset"] = offset.ToString(),
                        ["rating"] = "g"
                    };
                    var url = QueryHelpers.AddQueryString("https://api.giphy.com/v1/gifs/search", queryParams);
                    using var resp = await client.GetAsync(url);
                    var respBody = await resp.Content.ReadAsStringAsync();
                    if (!resp.IsSuccessStatusCode)
                        return StatusCode(502, new { error = $"Upstream HTTP error: {resp.StatusCode}" });

                    var json = JsonDocument.Parse(respBody);
                    if (json.RootElement.TryGetProperty("data", out var data))
                        allResults.AddRange(data.EnumerateArray());
                }

                foreach (var giphyItem in allResults)
                {
                    var mediaFormats = new Dictionary<string, object>();
                    if (giphyItem.TryGetProperty("images", out var images))
                    {
                        if (images.TryGetProperty("original", out var original))
                            mediaFormats["gif"] = new { url = original.GetProperty("url").GetString() };
                        if (images.TryGetProperty("downsized", out var downsized))
                            mediaFormats["tinygif"] = new { url = downsized.GetProperty("url").GetString() };
                    }

                    normalizedResults.Add(new
                    {
                        id = giphyItem.GetProperty("id").GetString(),
                        title = giphyItem.GetProperty("title").GetString(),
                        url = giphyItem.GetProperty("url").GetString(),
                        media_formats = mediaFormats
                    });
                }
            }
            else
            {
                return StatusCode(500, new { error = "No GIF provider API key is configured" });
            }

            var formatted = new { results = normalizedResults };
            body = JsonSerializer.Serialize(formatted);

            var cacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
            };
            _cache.Set(cacheKey, body, cacheOptions);

            return Content(body, "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

}
