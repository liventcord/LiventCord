using System.Text.RegularExpressions;
using LiventCord.Controllers;
using Microsoft.EntityFrameworkCore;

public class Metadata
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? SiteName { get; set; }
}

public class UrlMetadata
{
    public int Id { get; set; }
    public required string Domain { get; set; }
    public required string RoutePath { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? SiteName { get; set; }
}

public class MetadataService
{
    private readonly int PER_DOMAIN_LIMIT = 100;
    private readonly HttpClient _httpClient;
    private readonly AppDbContext _dbContext;

    public MetadataService(HttpClient httpClient, AppDbContext dbContext)
    {
        _httpClient = httpClient;
        _dbContext = dbContext;
    }

    public async Task<(string? Title, string? Description, string? SiteName)> ExtractMetadataAsync(
        string url
    )
    {
        var (domain, routePath) = ParseUrl(url);

        var existingMetadata = await _dbContext.UrlMetadata.FirstOrDefaultAsync(u =>
            u.Domain == domain && u.RoutePath == routePath
        );

        if (existingMetadata != null)
        {
            return (
                existingMetadata.Title,
                existingMetadata.Description,
                existingMetadata.SiteName
            );
        }

        var urlCountForDomain = await _dbContext.UrlMetadata.CountAsync(u => u.Domain == domain);

        if (urlCountForDomain >= PER_DOMAIN_LIMIT)
        {
            return ("Domain limit reached", null, null);
        }

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

            var newMetadata = new UrlMetadata
            {
                Domain = domain,
                RoutePath = routePath,
                Title = title,
                Description = description,
                SiteName = siteName,
            };
            _dbContext.UrlMetadata.Add(newMetadata);
            await _dbContext.SaveChangesAsync();

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

    private (string Domain, string RoutePath) ParseUrl(string url)
    {
        var uri = new Uri(url);
        var domain = uri.GetLeftPart(UriPartial.Authority);
        var routePath = uri.AbsolutePath.ToLower();

        return (domain, routePath);
    }
}
