using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Security.Cryptography;
using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using System.Text.Json;
using SixLabors.ImageSharp;
using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Options;

[Route("api/proxy/media")]
[ApiController]
public class MediaProxyController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private string _cacheDirectory;
    private static readonly ConcurrentDictionary<string, Task> _downloadTasks = new ConcurrentDictionary<string, Task>();
    private string _blacklistFilePath;
    private static readonly object _blacklistLock = new object();
    private static HashSet<string> _blacklistedUrls = new HashSet<string>();

    private long _storageLimitBytes;
    private string? _mainServerUrl;

    public MediaProxyController(MediaCacheSettings mediaCacheSettings)
    {
        _mainServerUrl = mediaCacheSettings.MainServerUrl;
        _cacheDirectory = mediaCacheSettings.CacheDirectory;
        _storageLimitBytes = mediaCacheSettings.StorageLimitBytes;
        _blacklistFilePath = Path.Combine(_cacheDirectory, "blacklisted_urls.json");

        LoadBlacklistedUrls();

        var handler = new HttpClientHandler();

        _httpClient = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(60)
        };
        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36");
        _httpClient.DefaultRequestHeaders.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8");
        _httpClient.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en-US,en;q=0.9");
        _httpClient.DefaultRequestHeaders.AcceptEncoding.ParseAdd("gzip, deflate, br");
        _httpClient.DefaultRequestHeaders.Connection.ParseAdd("keep-alive");


    }




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
            Console.WriteLine($"Error loading blacklisted URLs: {ex.Message}");
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
                Console.WriteLine($"Error saving blacklisted URLs: {ex.Message}");
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
    [HttpGet]
    public async Task<IActionResult> GetMedia([FromQuery] string url)
    {
        if (string.IsNullOrEmpty(url))
            return BadRequest("URL parameter is required.");

        if (IsUrlBlacklisted(url))
        {
            return BadRequest("This URL has been blacklisted due to previous errors or invalid content type.");
        }

        string filePath = GetCacheFilePath(url);

        if (System.IO.File.Exists(filePath))
        {
            return await HandleFileResponse(filePath);
        }

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

        if (System.IO.File.Exists(filePath))
        {
            return await HandleFileResponse(filePath);
        }

        return StatusCode(502);
    }

    private async Task<IActionResult> HandleFileResponse(string filePath)
    {
        var fileInfo = new FileInfo(filePath);
        var lastModified = fileInfo.LastWriteTimeUtc;
        var etag = GenerateETag(filePath);

        Response.Headers.Append("Cache-Control", "public, max-age=31536000");
        Response.Headers.Append("Last-Modified", lastModified.ToString("R"));
        Response.Headers.Append("ETag", etag);

        if (Request.Headers.ContainsKey("If-None-Match") && Request.Headers["If-None-Match"].ToString() == etag)
        {
            return StatusCode(304);
        }

        if (Request.Headers.ContainsKey("Range"))
        {
            return await HandleRangeRequest(filePath);
        }

        string mimeType = GetMimeTypeFromContent(filePath);
        return PhysicalFile(filePath, mimeType, Path.GetFileName(filePath));
    }


    private string GetMimeTypeFromContent(string filePath)
    {
        var mimeType = MimeKit.MimeTypes.GetMimeType(filePath);
        return mimeType ?? "application/octet-stream";
    }

    private string GenerateETag(string filePath)
    {
        var fileInfo = new FileInfo(filePath);
        using (var stream = fileInfo.OpenRead())
        {
            var hash = MD5.Create().ComputeHash(stream);
            return Convert.ToBase64String(hash);
        }
    }

    private async Task<IActionResult> HandleRangeRequest(string filePath)
    {
        var fileInfo = new FileInfo(filePath);
        var fileLength = fileInfo.Length;

        var rangeHeader = Request.Headers["Range"].ToString();
        var rangeMatch = Regex.Match(rangeHeader, @"bytes=(\d+)-(\d*)");

        if (rangeMatch.Success)
        {
            var start = long.Parse(rangeMatch.Groups[1].Value);
            var end = rangeMatch.Groups[2].Length > 0 ? long.Parse(rangeMatch.Groups[2].Value) : fileLength - 1;

            if (start >= fileLength || end >= fileLength)
            {
                return StatusCode(416);
            }

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

        return StatusCode(416, "Invalid Range");
    }

    private void EnforceStorageLimit()
    {
        var files = new DirectoryInfo(_cacheDirectory).GetFiles().OrderBy(f => f.LastAccessTimeUtc).ToList();
        long totalSize = files.Sum(f => f.Length);

        while (totalSize > _storageLimitBytes && files.Count > 0)
        {
            var oldestFile = files.First();
            if (oldestFile.Name == "blacklisted_urls.json")
            {
                files.RemoveAt(0);
                continue;
            }

            totalSize -= oldestFile.Length;
            oldestFile.Delete();
            files.RemoveAt(0);
        }
    }

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

            if (response.StatusCode == HttpStatusCode.Found ||
                response.StatusCode == HttpStatusCode.MovedPermanently ||
                response.StatusCode == HttpStatusCode.SeeOther ||
                response.StatusCode == HttpStatusCode.TemporaryRedirect ||
                response.StatusCode == HttpStatusCode.PermanentRedirect)
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

        if (!IsValidMediaContentType(response))
        {
            AddToBlacklist(url, $"Invalid media type: {response.Content.Headers.ContentType?.MediaType}");
            throw new InvalidOperationException($"Invalid media type: {response.Content.Headers.ContentType?.MediaType} from {url}");
        }

        EnforceStorageLimit();
        var tempFilePath = filePath + ".tmp";
        try
        {
            using (var fileStream = new FileStream(tempFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await response.Content.CopyToAsync(fileStream);
            }

            System.IO.File.Move(tempFilePath, filePath);
        }
        catch (Exception ex)
        {
            AddToBlacklist(url, $"File save error: {ex.Message}");
            throw new InvalidOperationException($"Error saving file {filePath}: {ex.Message}");
        }
        var mediaUrl = new MediaUrl
        {
            Url = url,
            IsImage = IsImageContentType(response),
            IsVideo = IsVideoContentType(response),
            FileSize = response.Content.Headers.ContentLength ?? 0,
            Width = GetImageWidth(filePath),
            Height = GetImageHeight(filePath),
            FileName = response.Content.Headers.ContentDisposition?.FileName?.Trim('"') ?? Path.GetFileName(filePath)
        };

        await SendToMainServer(mediaUrl);
    }
    private async Task SendToMainServer(MediaUrl mediaUrls)
    {
        Console.WriteLine(_mainServerUrl + "Sending to main server: " + mediaUrls.Url);
        if (string.IsNullOrEmpty(_mainServerUrl)) return;
        try
        {
            var content = JsonContent.Create(mediaUrls);
            var response = await _httpClient.PostAsync(_mainServerUrl + "/api/media", content);

            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException($"Failed to send media info to main server - Status: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error sending media info to main server: {ex.Message}");
        }
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

        if (contentType == null ||
            contentType.StartsWith("text/") ||
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

    private string GetCacheFilePath(string url)
    {
        using (var md5 = MD5.Create())
        {
            var hash = md5.ComputeHash(System.Text.Encoding.UTF8.GetBytes(url));
            return Path.Combine(_cacheDirectory, BitConverter.ToString(hash).Replace("-", "").ToLower());
        }
    }

    private int GetImageWidth(string filePath)
    {
        try
        {
            using (var image = Image.Load(filePath))
            {
                return image.Width;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting image width: {ex.Message}");
            return 0;
        }
    }

    private int GetImageHeight(string filePath)
    {
        try
        {
            using (var image = Image.Load(filePath))
            {
                return image.Height;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting image height: {ex.Message}");
            return 0;
        }
    }


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
