using System.Text.RegularExpressions;

public class Metadata
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? SiteName { get; set; }
}

public class MetadataService
{
    private readonly HttpClient _httpClient;

    public MetadataService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<(string? Title, string? Description, string? SiteName)> ExtractMetadataAsync(
        string url
    )
    {
        try
        {
            var html = await FetchHtmlAsync(url);

            var title = ExtractFirstMatch(
                html,
                new[]
                {
                    @"<title>([^<]*)<\/title>",
                    @"<meta\s+property=[""']og:title[""']\s+content=[""']([^""']*)[""']",
                    @"<meta\s+name=[""']twitter:title[""']\s+content=[""']([^""']*)[""']",
                    @"<meta\s+itemprop=[""']name[""']\s+content=[""']([^""']*)[""']",
                }
            );

            var description = ExtractFirstMatch(
                html,
                new[]
                {
                    @"<meta\s+name=[""']description[""']\s+content=[""']([^""']*)[""']",
                    @"<meta\s+property=[""']og:description[""']\s+content=[""']([^""']*)[""']",
                    @"<meta\s+name=[""']twitter:description[""']\s+content=[""']([^""']*)[""']",
                    @"<meta\s+itemprop=[""']description[""']\s+content=[""']([^""']*)[""']",
                }
            );

            var siteName =
                ExtractFirstMatch(
                    html,
                    new[]
                    {
                        @"<meta\s+property=[""']og:site_name[""']\s+content=[""']([^""']*)[""']",
                    }
                ) ?? url;

            return (title, description, siteName);
        }
        catch
        {
            return ("Metadata Extraction Failed", null, null);
        }
    }

    private async Task<string> FetchHtmlAsync(string url)
    {
        var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }

    private string? ExtractFirstMatch(string html, string[] patterns)
    {
        foreach (var pattern in patterns)
        {
            var match = Regex.Match(html, pattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                return System.Net.WebUtility.HtmlDecode(match.Groups[1].Value);
            }
        }
        return null;
    }
}
