using System.Text.Json;
using LiventCord.Controllers;
using LiventCord.Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

public class Metadata
{
    public string? Type { get; set; }

    public string? PinnerUserId { get; set; }

    public DateTime? PinnedAt { get; set; }

    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? SiteName { get; set; }
    public string? Image { get; set; }
    public string? Url { get; set; }
    public string? Keywords { get; set; }
    public string? Author { get; set; }

    public bool IsEmpty()
    {
        return string.IsNullOrWhiteSpace(Type)
            && string.IsNullOrWhiteSpace(PinnerUserId)
            && PinnedAt == null
            && string.IsNullOrWhiteSpace(Title)
            && string.IsNullOrWhiteSpace(Description)
            && string.IsNullOrWhiteSpace(SiteName)
            && string.IsNullOrWhiteSpace(Image)
            && string.IsNullOrWhiteSpace(Url)
            && string.IsNullOrWhiteSpace(Keywords)
            && string.IsNullOrWhiteSpace(Author);
    }
}

public class UrlMetadata : Metadata
{
    public int Id { get; set; }
    public required string Domain { get; set; }
    public required string RoutePath { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class MetadataWithMedia
{
    public Metadata? metadata { get; set; }
    public MediaUrl? mediaUrl { get; set; }
}

[Route("api/v1/metadata")]
[ApiController]
public class MetadataController : ControllerBase
{
    private readonly int MetadataDomainLimit;
    private readonly bool _isMetadataEnabled;
    private readonly AppDbContext _dbContext;
    private readonly HttpClient _httpClient;
    private readonly IAppLogger<MetadataController> _logger;
    private readonly MediaProxyController _mediaProxycontroller;

    public MetadataController(
        AppDbContext dbContext,
        IConfiguration configuration,
        HttpClient httpClient,
        MediaProxyController mediaProxyController,
        IAppLogger<MetadataController> logger
    )
    {
        _dbContext = dbContext;
        _isMetadataEnabled = configuration.GetValue<bool>("AppSettings:EnableMetadataIndexing");
        MetadataDomainLimit = configuration.GetValue<int>("AppSettings:MetadataDomainLimit", 100);
        _httpClient = httpClient;
        _logger = logger;
        _mediaProxycontroller = mediaProxyController;
    }

    [NonAction]
    public async Task<Metadata> FetchMetadataFromProxyAsync(List<string> urls, string messageId)
    {
        if (urls.Count == 0 || !Uri.IsWellFormedUriString(SharedAppConfig.MediaWorkerUrl, UriKind.Absolute))
            return new Metadata();

        var request = new HttpRequestMessage(
            HttpMethod.Post,
            SharedAppConfig.MediaWorkerUrl + "/api/v1/proxy/metadata"
        )
        {
            Content = JsonContent.Create(urls),
        };

        request.Headers.Add("Authorization", SharedAppConfig.AdminKey);

        var response = await _httpClient.SendAsync(request, CancellationToken.None);

        _logger.LogInformation("Status Code: " + response.StatusCode);

        var rawResponse = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError(
                SharedAppConfig.MediaWorkerUrl
                    + "/api/v1/proxy/metadata"
                    + " Request to proxy server failed: "
                    + response.StatusCode
                    + " "
                    + rawResponse
            );
            return new Metadata();
        }

        var metadataList = JsonSerializer.Deserialize<List<MetadataWithMedia>>(rawResponse);
        if (metadataList == null)
            return new Metadata();

        var mediaUrls = new List<MediaUrl>();
        foreach (var metadataWithUrls in metadataList)
        {
            var mediaUrl = metadataWithUrls.mediaUrl;
            if (mediaUrl != null)
            {
                await _mediaProxycontroller.AddMediaUrl(mediaUrl, messageId);
                mediaUrls.Add(mediaUrl);
            }
        }

        var metadataResult = metadataList.Select(m => m.metadata).ToList();
        return metadataResult[0] ?? new Metadata();
    }

    [HttpPost("")]
    public async Task<IActionResult> SaveMetadataAsync([FromBody] UrlMetadata urlMetadata)
    {
        if (!_isMetadataEnabled)
        {
            return Forbid("Metadata indexing is disabled");
        }

        var existingMetadata = await _dbContext.UrlMetadata.AsNoTracking().FirstOrDefaultAsync(u =>
            u.Domain == urlMetadata.Domain && u.RoutePath == urlMetadata.RoutePath
        );

        if (existingMetadata != null)
        {
            return Conflict();
        }

        var currentTime = DateTime.UtcNow;
        var twentyFourHoursAgo = currentTime.AddHours(-24);

        var urlCountForDomain = await _dbContext.UrlMetadata.CountAsync(u =>
            u.Domain == urlMetadata.Domain && u.CreatedAt >= twentyFourHoursAgo
        );

        if (urlCountForDomain >= MetadataDomainLimit)
        {
            return StatusCode(
                StatusCodes.Status429TooManyRequests,
                "Rate limit exceeded for this domain."
            );
        }

        try
        {
            _dbContext.UrlMetadata.Add(urlMetadata);
            await _dbContext.SaveChangesAsync();
            return Ok();
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, ex);
        }
    }
}
