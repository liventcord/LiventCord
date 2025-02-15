using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Security.Cryptography;
using System.Collections.Concurrent;
using Microsoft.AspNetCore.StaticFiles;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("api/proxy/media")]
    [ApiController]
    public class MediaProxyController : ControllerBase
    {
        private readonly HttpClient _httpClient;
        private readonly string _cacheDirectory = Path.Combine(Directory.GetCurrentDirectory(), "MediaCache");
        private readonly AppDbContext _dbContext;
        private static readonly ConcurrentDictionary<string, Task> _downloadTasks = new ConcurrentDictionary<string, Task>();

        private readonly long _storageLimitBytes;

        public MediaProxyController(AppDbContext dbContext, IConfiguration configuration, MediaCacheSettings mediaCacheSettings)
        {
            _dbContext = dbContext;
            _cacheDirectory = mediaCacheSettings.CacheDirectory;
            _storageLimitBytes = mediaCacheSettings.StorageLimitBytes;

            var proxyUrl = mediaCacheSettings.MediaProxy;
            var handler = new HttpClientHandler();
            if (!string.IsNullOrEmpty(proxyUrl))
            {
                handler.Proxy = new WebProxy(proxyUrl);
                handler.UseProxy = true;
            }
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






        [HttpGet]
        public async Task<IActionResult> GetMedia([FromQuery] string url)
        {
            if (string.IsNullOrEmpty(url))
                return BadRequest("URL parameter is required.");

            var urlStatus = await _dbContext.UrlStatuses
                .FirstOrDefaultAsync(u => u.Url == url);

            if (urlStatus != null && !urlStatus.IsMedia)
            {
                return StatusCode(415, "URL is not a valid media file.");
            }

            string filePath = GetCacheFilePath(url);

            if (System.IO.File.Exists(filePath))
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
                return PhysicalFile(filePath, GetMimeType(filePath));
            }

            var downloadTask = _downloadTasks.GetOrAdd(filePath, _ => DownloadFileAsync(url, filePath));
            try
            {
                await downloadTask;
            }
            catch (Exception ex)
            {
                return StatusCode(502, url + ex.ToString());
            }
            finally
            {
                _downloadTasks.TryRemove(filePath, out _);
            }

            if (System.IO.File.Exists(filePath))
            {
                var fileInfo = new FileInfo(filePath);
                var lastModified = fileInfo.LastWriteTimeUtc;
                var etag = GenerateETag(filePath);

                Response.Headers.Append("Cache-Control", "public, max-age=31536000");
                Response.Headers.Append("Last-Modified", lastModified.ToString("R"));
                Response.Headers.Append("ETag", etag);

                if (Request.Headers.ContainsKey("Range"))
                {
                    return await HandleRangeRequest(filePath);
                }
                return PhysicalFile(filePath, GetMimeType(filePath));
            }

            return StatusCode(502);
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
                if (response.StatusCode == HttpStatusCode.Found ||
                    response.StatusCode == HttpStatusCode.MovedPermanently ||
                    response.StatusCode == HttpStatusCode.SeeOther ||
                    response.StatusCode == HttpStatusCode.TemporaryRedirect ||
                    response.StatusCode == HttpStatusCode.PermanentRedirect)
                {
                    url = response.Headers.Location?.AbsoluteUri ?? "";
                    if (string.IsNullOrEmpty(url)) return;
                    redirectCount++;
                    continue;
                }
                break;
            }
            if (response == null || !response.IsSuccessStatusCode)
                throw new InvalidOperationException($"Failed request to {url} - Status: {response?.StatusCode} - {response?.ReasonPhrase}");
            if (!IsValidMediaContentType(response))
            {
                await MarkUrlAsNotMedia(url);
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
                throw new InvalidOperationException($"Error saving file {filePath}: {ex.Message}");
            }
        }

        private bool IsValidMediaContentType(HttpResponseMessage response)
        {
            var contentType = response.Content.Headers.ContentType?.MediaType?.ToLower();
            return contentType?.StartsWith("image/") == true || contentType?.StartsWith("video/") == true || contentType?.StartsWith("audio/") == true;
        }

        private async Task MarkUrlAsNotMedia(string url)
        {

            var existingStatus = await _dbContext.UrlStatuses
                .FirstOrDefaultAsync(u => u.Url == url);

            if (existingStatus == null)
            {
                _dbContext.UrlStatuses.Add(new UrlStatus
                {
                    Url = url,
                    IsMedia = false,
                    DateChecked = DateTime.UtcNow
                });
            }
            else
            {
                existingStatus.IsMedia = false;
                existingStatus.DateChecked = DateTime.UtcNow;
            }

            await _dbContext.SaveChangesAsync();
        }

        private string GetCacheFilePath(string url)
        {
            using (var md5 = MD5.Create())
            {
                var hash = md5.ComputeHash(System.Text.Encoding.UTF8.GetBytes(url));
                return Path.Combine(_cacheDirectory, BitConverter.ToString(hash).Replace("-", "").ToLower());
            }
        }

        private string GetMimeType(string filePath)
        {
            var provider = new FileExtensionContentTypeProvider();
            if (provider.TryGetContentType(filePath, out var mimeType))
            {
                return mimeType;
            }

            return "application/octet-stream";
        }


    }


    public class UrlStatus
    {
        public int Id { get; set; }
        public required string Url { get; set; }
        public bool IsMedia { get; set; }
        public DateTime DateChecked { get; set; }
    }

}