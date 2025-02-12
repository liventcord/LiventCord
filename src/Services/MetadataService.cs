using System.Text.RegularExpressions;
using LiventCord.Controllers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using HtmlAgilityPack;

public class Metadata
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? SiteName { get; set; }
    public string? Image { get; set; }
    public string? Url { get; set; }
    public string? Type { get; set; }
    public string? Keywords { get; set; }
    public string? Author { get; set; }
}

public class UrlMetadata : Metadata
{
    public int Id { get; set; }
    public required string Domain { get; set; }
    public required string RoutePath { get; set; }
    public DateTime CreatedAt { get; set; } 
}

public class MetadataService
{
    private readonly int MetadataDomainLimit;
    private readonly HttpClient _httpClient;
    private readonly AppDbContext _dbContext;
    private readonly bool _isMetadataEnabled;

    public MetadataService(HttpClient httpClient, AppDbContext dbContext, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _dbContext = dbContext;
        _isMetadataEnabled = configuration.GetValue<bool>("AppSettings:EnableMetadataIndexing");
        MetadataDomainLimit = configuration.GetValue<int>("AppSettings:MetadataDomainLimit",100);
    }

    public async Task<Metadata> ExtractMetadataAsync(string url)
    {
        if (!_isMetadataEnabled)
        {
            return new Metadata { Title = "Metadata indexing is disabled" };
        }

        var (domain, routePath) = ParseUrl(url);

        var existingMetadata = await _dbContext.UrlMetadata.FirstOrDefaultAsync(u =>
            u.Domain == domain && u.RoutePath == routePath
        );

        if (existingMetadata != null)
        {
            return MapToMetadata(existingMetadata);
        }

        var currentTime = DateTime.UtcNow;
        var twentyFourHoursAgo = currentTime.AddHours(-24);

        var urlCountForDomain = await _dbContext.UrlMetadata.CountAsync(u =>
            u.Domain == domain && u.CreatedAt >= twentyFourHoursAgo
        );

        if (urlCountForDomain >= MetadataDomainLimit)
        {
            return new Metadata { Title = "Domain limit reached" };
        }

        try
        {
            var html = await FetchHtmlAsync(url);
            var htmlDocument = new HtmlDocument();
            htmlDocument.LoadHtml(html);

            var newMetadata = new UrlMetadata
            {
                Domain = domain,
                RoutePath = routePath,
                Title = htmlDocument.DocumentNode.SelectSingleNode("//title")?.InnerText ??
                        htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:title']")?.GetAttributeValue("content", null),
                Description = htmlDocument.DocumentNode.SelectSingleNode("//meta[@name='description']")?.GetAttributeValue("content", null) ??
                            htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:description']")?.GetAttributeValue("content", null),
                SiteName = htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:site_name']")?.GetAttributeValue("content", null) ?? url,
                Image = htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:image']")?.GetAttributeValue("content", null) ??
                        htmlDocument.DocumentNode.SelectSingleNode("//meta[@name='twitter:image']")?.GetAttributeValue("content", null),
                Url = htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:url']")?.GetAttributeValue("content", null) ?? url,
                Type = htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:type']")?.GetAttributeValue("content", null),
                Keywords = htmlDocument.DocumentNode.SelectSingleNode("//meta[@name='keywords']")?.GetAttributeValue("content", null),
                Author = htmlDocument.DocumentNode.SelectSingleNode("//meta[@name='author']")?.GetAttributeValue("content", null),
                CreatedAt = currentTime
            };

            _dbContext.UrlMetadata.Add(newMetadata);
            await _dbContext.SaveChangesAsync();

            return MapToMetadata(newMetadata);
        }
        catch (Exception)
        {
            return new Metadata { Title = "Metadata Extraction Failed" };
        }
    }

    private Metadata MapToMetadata(UrlMetadata urlMetadata)
    {
        return new Metadata
        {
            Title = urlMetadata.Title,
            Description = urlMetadata.Description,
            SiteName = urlMetadata.SiteName,
            Image = urlMetadata.Image,
            Url = urlMetadata.Url,
            Type = urlMetadata.Type,
            Keywords = urlMetadata.Keywords,
            Author = urlMetadata.Author
        };
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
