using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Security.Cryptography;
using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using System.Text.Json;
using SixLabors.ImageSharp;
using System.ComponentModel.DataAnnotations;
using HtmlAgilityPack;

[ApiController]
public class MediaProxyController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly string _cacheDirectory;
    private readonly ILogger<MediaProxyController> _logger;
    private readonly string _blacklistFilePath;
    private readonly long _storageLimitBytes;
    private readonly string? _mainServerUrl;

    private static readonly ConcurrentDictionary<string, Task> _downloadTasks = new();
    private static readonly object _blacklistLock = new();
    private static HashSet<string> _blacklistedUrls = new();

    public MediaProxyController(MediaCacheSettings mediaCacheSettings, ILogger<MediaProxyController> logger)
    {
        _logger = logger;
        _mainServerUrl = mediaCacheSettings.MainServerUrl;
        _cacheDirectory = mediaCacheSettings.CacheDirectory;
        _storageLimitBytes = mediaCacheSettings.StorageLimitBytes;
        _blacklistFilePath = Path.Combine(_cacheDirectory, "blacklisted_urls.json");
        _httpClient = new HttpClient();

        LoadBlacklistedUrls();
        InitializeHttpClient(_httpClient);
    }

    private void InitializeHttpClient(HttpClient _httpClient)
    {
        _httpClient.Timeout = TimeSpan.FromMinutes(1);
        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36");
        _httpClient.DefaultRequestHeaders.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8");
        _httpClient.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en-US,en;q=0.9");
        _httpClient.DefaultRequestHeaders.AcceptEncoding.ParseAdd("gzip, deflate, br");
        _httpClient.DefaultRequestHeaders.Connection.ParseAdd("keep-alive");
    }

    #region Blacklist Management

    private void LoadBlacklistedUrls()
    {
        try
        {
            if (System.IO.File.Exists(_blacklistFilePath))
            {
                var json = System.IO.File.ReadAllText(_blacklistFilePath);
                var blacklist = JsonSerializer.Deserialize<HashSet<string>>(json);
                if (blacklist != null)
                {
                    lock (_blacklistLock)
                    {
                        _blacklistedUrls = blacklist;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogInformation($"Error loading blacklisted URLs: {ex.Message}");
        }
    }

    private void AddToBlacklist(string url, string reason)
    {
        lock (_blacklistLock)
        {
            _blacklistedUrls.Add(url);
            try
            {
                var json = JsonSerializer.Serialize(_blacklistedUrls, new JsonSerializerOptions { WriteIndented = true });
                System.IO.File.WriteAllText(_blacklistFilePath, json);
            }
            catch (Exception ex)
            {
                _logger.LogInformation($"Error saving blacklisted URLs: {ex.Message}");
            }
        }
    }

    private bool IsUrlBlacklisted(string url)
    {
        lock (_blacklistLock)
        {
            return _blacklistedUrls.Contains(url);
        }
    }

    #endregion

    #region Media Endpoints

    [HttpGet("/api/proxy/media")]
    public async Task<IActionResult> GetMedia([FromQuery] string url)
    {
        if (string.IsNullOrEmpty(url))
            return BadRequest("URL parameter is required.");

        if (IsUrlBlacklisted(url))
            return BadRequest("This URL has been blacklisted due to previous errors or invalid content type.");

        string filePath = GetCacheFilePath(url);

        if (System.IO.File.Exists(filePath))
            return await HandleFileResponse(filePath);

        var downloadTask = _downloadTasks.GetOrAdd(filePath, _ => DownloadFileAsync(url, filePath));
        try
        {
            await downloadTask;
        }
        catch (Exception ex)
        {
            AddToBlacklist(url, ex.Message);
            return StatusCode(502, $"{url} - {ex.Message}");
        }
        finally
        {
            _downloadTasks.TryRemove(filePath, out _);
        }

        return System.IO.File.Exists(filePath)
            ? await HandleFileResponse(filePath)
            : StatusCode(502);
    }

    [HttpPost("/api/proxy/metadata")]
    public async Task<MetadataWithMedia> FetchMetadata([FromBody] string url)
    {
        _logger.LogInformation($"Received metadata fetch request for URL: {url}");

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);

        _logger.LogInformation($"Response status code: {response.StatusCode}");

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            _logger.LogWarning($"Request to fetch HTML failed: {response.StatusCode}, Response body: {errorBody}");
            return new MetadataWithMedia(null, new Metadata());
        }

        var contentType = response.Content.Headers.ContentType?.MediaType;
        _logger.LogInformation($"Content-Type: {contentType}");

        Metadata? metadata = null;
        MediaUrl? mediaUrl = null;
        bool isMediaContent = IsValidMediaContentType(response);

        if (contentType != null && contentType.Contains("text/html", StringComparison.OrdinalIgnoreCase))
        {
            var content = await response.Content.ReadAsStringAsync();
            _logger.LogInformation($"HTML content fetched, length: {content.Length}");
            metadata = ExtractMetadataFromHtml(url, content);
        }

        if (isMediaContent)
        {
            string filePath = GetCacheFilePath(url);
            _logger.LogInformation($"Saving media content to file: {filePath}");

            await SaveResponseToFile(response, filePath);

            mediaUrl = new MediaUrl
            {
                Url = url,
                IsImage = IsImageContentType(response),
                IsVideo = IsVideoContentType(response),
                FileSize = response.Content.Headers.ContentLength ?? 0,
                Width = GetImageDimension(filePath, true),
                Height = GetImageDimension(filePath, false),
                FileName = GetFileName(response, url)
            };

            _logger.LogInformation($"MediaUrl constructed: {mediaUrl.FileName}, {mediaUrl.Width}x{mediaUrl.Height}, {mediaUrl.FileSize} bytes");
        }

        _logger.LogInformation("Metadata fetch complete");
        return new MetadataWithMedia(mediaUrl, metadata);
    }

    #endregion

    #region File Operations

    private async Task<IActionResult> HandleFileResponse(string filePath)
    {
        var fileInfo = new FileInfo(filePath);
        var lastModified = fileInfo.LastWriteTimeUtc;
        var etag = GenerateETag(filePath);

        Response.Headers.Append("Cache-Control", "public, max-age=31536000");
        Response.Headers.Append("Last-Modified", lastModified.ToString("R"));
        Response.Headers.Append("ETag", etag);

        if (Request.Headers.ContainsKey("If-None-Match") && Request.Headers["If-None-Match"].ToString() == etag)
            return StatusCode(304);

        if (Request.Headers.ContainsKey("Range"))
            return await HandleRangeRequest(filePath);

        string mimeType = MimeKit.MimeTypes.GetMimeType(filePath) ?? "application/octet-stream";
        return PhysicalFile(filePath, mimeType, Path.GetFileName(filePath));
    }

    private string GenerateETag(string filePath)
    {
        var fileInfo = new FileInfo(filePath);
        using var stream = fileInfo.OpenRead();
        var hash = MD5.Create().ComputeHash(stream);
        return Convert.ToBase64String(hash);
    }

    private async Task<IActionResult> HandleRangeRequest(string filePath)
    {
        var fileInfo = new FileInfo(filePath);
        var fileLength = fileInfo.Length;

        var rangeHeader = Request.Headers["Range"].ToString();
        var rangeMatch = Regex.Match(rangeHeader, @"bytes=(\d+)-(\d*)");

        if (!rangeMatch.Success)
            return StatusCode(416, "Invalid Range");

        var start = long.Parse(rangeMatch.Groups[1].Value);
        var end = rangeMatch.Groups[2].Length > 0 ? long.Parse(rangeMatch.Groups[2].Value) : fileLength - 1;

        if (start >= fileLength || end >= fileLength)
            return StatusCode(416);

        var contentLength = end - start + 1;
        var contentRange = $"bytes {start}-{end}/{fileLength}";

        Response.StatusCode = 206;
        Response.ContentLength = contentLength;
        Response.Headers.Append("Content-Range", contentRange);

        using (var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            fileStream.Seek(start, SeekOrigin.Begin);
            await fileStream.CopyToAsync(Response.Body, (int)contentLength);
        }

        return new EmptyResult();
    }

    private async Task SaveResponseToFile(HttpResponseMessage response, string filePath)
    {
        var tempFilePath = filePath + ".tmp";
        try
        {
            using (var fileStream = new FileStream(tempFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await response.Content.CopyToAsync(fileStream);
            }

            System.IO.File.Move(tempFilePath, filePath, true);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Error saving file {filePath}: {ex.Message}");
        }
    }

    private void EnforceStorageLimit()
    {
        var files = new DirectoryInfo(_cacheDirectory)
            .GetFiles()
            .Where(f => f.Name != "blacklisted_urls.json")
            .OrderBy(f => f.LastAccessTimeUtc)
            .ToList();

        long totalSize = files.Sum(f => f.Length);

        while (totalSize > _storageLimitBytes && files.Count > 0)
        {
            var oldestFile = files.First();
            totalSize -= oldestFile.Length;
            oldestFile.Delete();
            files.RemoveAt(0);
        }
    }

    private string GetCacheFilePath(string url)
    {
        using var md5 = MD5.Create();
        var hash = md5.ComputeHash(System.Text.Encoding.UTF8.GetBytes(url));
        return Path.Combine(_cacheDirectory, BitConverter.ToString(hash).Replace("-", "").ToLower());
    }

    #endregion

    #region Download and Processing

    private async Task DownloadFileAsync(string url, string filePath)
    {
        const int maxRedirects = 5;
        int redirectCount = 0;
        HttpResponseMessage? response = null;

        while (redirectCount < maxRedirects)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);

            if (!response.IsSuccessStatusCode)
            {
                AddToBlacklist(url, $"HTTP Error: {response.StatusCode} {response.ReasonPhrase}");
                throw new InvalidOperationException($"Failed request to {url} - Status: {response.StatusCode} - {response.ReasonPhrase}");
            }

            if (IsRedirect(response.StatusCode))
            {
                url = response.Headers.Location?.AbsoluteUri ?? "";
                if (string.IsNullOrEmpty(url))
                {
                    AddToBlacklist(url, "Empty redirect URL");
                    return;
                }

                if (IsUrlBlacklisted(url))
                {
                    throw new InvalidOperationException($"Redirect URL {url} is blacklisted");
                }

                redirectCount++;
                continue;
            }

            break;
        }

        if (response == null)
        {
            AddToBlacklist(url, "Null response");
            throw new InvalidOperationException($"Failed request to {url} - Null response");
        }

        var contentType = response.Content.Headers.ContentType?.MediaType;

        if (contentType != null && contentType.Contains("text/html", StringComparison.OrdinalIgnoreCase))
        {
            var (domain, routePath) = ParseUrl(url);
            var content = await response.Content.ReadAsStringAsync();
            await SendHtmlToMainServer(url, domain, routePath, content);
            return;
        }

        if (!IsValidMediaContentType(response))
        {
            AddToBlacklist(url, $"Invalid media type: {contentType}");
            throw new InvalidOperationException($"Invalid media type: {contentType} from {url}");
        }

        EnforceStorageLimit();

        try
        {
            await SaveResponseToFile(response, filePath);

            var mediaUrl = new MediaUrl
            {
                Url = url,
                IsImage = IsImageContentType(response),
                IsVideo = IsVideoContentType(response),
                FileSize = response.Content.Headers.ContentLength ?? 0,
                Width = GetImageDimension(filePath, true),
                Height = GetImageDimension(filePath, false),
                FileName = GetFileName(response, url)
            };

            await SendMediaUrlsToMainServer(mediaUrl);
        }
        catch (Exception ex)
        {
            AddToBlacklist(url, $"File processing error: {ex.Message}");
            throw;
        }
    }

    #endregion

    #region Helper Methods

    private bool IsRedirect(HttpStatusCode statusCode)
    {
        return statusCode == HttpStatusCode.Found ||
               statusCode == HttpStatusCode.MovedPermanently ||
               statusCode == HttpStatusCode.SeeOther ||
               statusCode == HttpStatusCode.TemporaryRedirect ||
               statusCode == HttpStatusCode.PermanentRedirect;
    }

    private string GetFileName(HttpResponseMessage response, string url)
    {
        return response.Content.Headers.ContentDisposition?.FileName?.Trim('"') ??
               Path.GetFileName(url);
    }

    private bool IsImageContentType(HttpResponseMessage response)
    {
        var contentType = response.Content.Headers.ContentType?.MediaType?.ToLower();
        return contentType?.StartsWith("image/") ?? false;
    }

    private bool IsVideoContentType(HttpResponseMessage response)
    {
        var contentType = response.Content.Headers.ContentType?.MediaType?.ToLower();
        return contentType?.StartsWith("video/") ?? false;
    }

    private bool IsValidMediaContentType(HttpResponseMessage response)
    {
        var contentType = response.Content.Headers.ContentType?.MediaType?.ToLower();

        if (contentType == null)
            return false;

        if (contentType.StartsWith("text/") ||
            contentType.Equals("application/json") ||
            contentType.Equals("application/xml") ||
            contentType.Equals("application/javascript"))
        {
            return false;
        }

        return contentType.StartsWith("image/") ||
               contentType.StartsWith("video/") ||
               contentType.StartsWith("audio/");
    }

    private int GetImageDimension(string filePath, bool isWidth)
    {
        try
        {
            using var image = Image.Load(filePath);
            return isWidth ? image.Width : image.Height;
        }
        catch (Exception ex)
        {
            _logger.LogInformation($"Error getting image dimension: {ex.Message}");
            return 0;
        }
    }

    #endregion

    #region Server Communication

    public static (string Domain, string RoutePath) ParseUrl(string url)
    {
        var uri = new Uri(url);
        var domain = uri.GetLeftPart(UriPartial.Authority);
        var routePath = uri.AbsolutePath.ToLower();

        return (domain, routePath);
    }

    private async Task SendMediaUrlsToMainServer(MediaUrl mediaUrl)
    {
        if (string.IsNullOrEmpty(_mainServerUrl)) return;

        try
        {
            var content = JsonContent.Create(mediaUrl);
            var response = await _httpClient.PostAsync($"{_mainServerUrl}/api/media", content);

            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException($"Failed to send media info to main server - Status: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogInformation($"Error sending media info to main server: {ex.Message}");
        }
    }

    private async Task SendHtmlToMainServer(string url, string domain, string routePath, string html)
    {
        if (string.IsNullOrEmpty(_mainServerUrl)) return;

        try
        {
            var metadata = ExtractMetadataFromHtml(url, html);
            var content = JsonContent.Create(metadata);
            var response = await _httpClient.PostAsync($"{_mainServerUrl}/api/metadata", content);

            if ((int)response.StatusCode == StatusCodes.Status403Forbidden)
            {
                _logger.LogInformation("Metadata indexing is disabled on the main server.");
            }
            else if (!response.IsSuccessStatusCode)
            {
                _logger.LogInformation($"Failed to send metadata to main server - Status: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogInformation($"Error sending HTML to main server: {ex.Message}");
        }
    }

    private static Metadata ExtractMetadataFromHtml(string url, string htmlContent)
    {
        var htmlDocument = new HtmlDocument();
        htmlDocument.LoadHtml(htmlContent);
        var (domain, routePath) = ParseUrl(url);

        return new UrlMetadata
        {
            Domain = domain,
            RoutePath = routePath,
            Title = htmlDocument.DocumentNode.SelectSingleNode("//title")?.InnerText ??
                    htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:title']")?.GetAttributeValue("content", null),
            Description = htmlDocument.DocumentNode.SelectSingleNode("//meta[@name='description']")?.GetAttributeValue("content", null) ??
                        htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:description']")?.GetAttributeValue("content", null),
            SiteName = htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:site_name']")?.GetAttributeValue("content", null) ?? domain,
            Image = htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:image']")?.GetAttributeValue("content", null) ??
                    htmlDocument.DocumentNode.SelectSingleNode("//meta[@name='twitter:image']")?.GetAttributeValue("content", null),
            Url = htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:url']")?.GetAttributeValue("content", null) ?? url,
            Type = htmlDocument.DocumentNode.SelectSingleNode("//meta[@property='og:type']")?.GetAttributeValue("content", null),
            Keywords = htmlDocument.DocumentNode.SelectSingleNode("//meta[@name='keywords']")?.GetAttributeValue("content", null),
            Author = htmlDocument.DocumentNode.SelectSingleNode("//meta[@name='author']")?.GetAttributeValue("content", null),
            CreatedAt = DateTime.UtcNow
        };
    }

    #endregion
}

public class MediaUrl
{
    [Key]
    public required string Url { get; set; }
    public required bool IsImage { get; set; }
    public required bool IsVideo { get; set; }
    public required string FileName { get; set; }
    public required long FileSize { get; set; }
    public required int? Width { get; set; }
    public required int? Height { get; set; }
}

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

    public bool IsEmpty()
    {
        return string.IsNullOrWhiteSpace(Title) &&
               string.IsNullOrWhiteSpace(Description) &&
               string.IsNullOrWhiteSpace(SiteName) &&
               string.IsNullOrWhiteSpace(Image) &&
               string.IsNullOrWhiteSpace(Url) &&
               string.IsNullOrWhiteSpace(Type) &&
               string.IsNullOrWhiteSpace(Keywords) &&
               string.IsNullOrWhiteSpace(Author);
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
    public Metadata? Metadata { get; set; }
    public MediaUrl? MediaUrl { get; set; }

    public MetadataWithMedia(MediaUrl? mediaUrl, Metadata? metadata)
    {
        MediaUrl = mediaUrl;
        Metadata = metadata;
    }
}
