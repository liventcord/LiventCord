using Microsoft.AspNetCore.Mvc;
using System.IO.Compression;
using System.Text;

[Route("api/proxy/backend")]
[ApiController]
public class ApiProxyController : ControllerBase
{
    private readonly ILogger<ApiProxyController> _logger;
    private readonly HttpClient _httpClient;
    private const string CodespaceBaseUrl = "https://verbose-zebra-4jqjrvqpwrg4f7rjp-5005.app.github.dev";

    public ApiProxyController(ILogger<ApiProxyController> logger, HttpClient httpClient)
    {
        _logger = logger;
        _httpClient = httpClient;
    }




    [Route("{*path}")]
    [HttpGet, HttpPost, HttpPut, HttpDelete, HttpPatch, HttpHead, HttpOptions]
    public async Task<IActionResult> Proxy(string path)
    {
        var uriBuilder = new UriBuilder(CodespaceBaseUrl)
        {
            Path = path,
            Query = Request.QueryString.Value?.TrimStart('?') ?? ""
        };
        _logger.LogInformation($"Proxying {Request.Method} {uriBuilder.Uri}");

        var requestMessage = new HttpRequestMessage(new HttpMethod(Request.Method), uriBuilder.Uri);

        foreach (var header in Request.Headers)
        {
            if (ShouldSkipRequestHeader(header.Key)) continue;
            requestMessage.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray());
        }

        if (HttpMethods.IsPost(Request.Method) ||
            HttpMethods.IsPut(Request.Method) ||
            HttpMethods.IsPatch(Request.Method))
        {
            Request.EnableBuffering();
            Request.Body.Position = 0;

            using var reader = new StreamReader(Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
            var bodyJson = await reader.ReadToEndAsync();
            Request.Body.Position = 0;

            _logger.LogInformation("Incoming JSON body:\n" + bodyJson);

            var contentType = Request.ContentType ?? "application/json";
            requestMessage.Content = new StringContent(bodyJson, Encoding.UTF8, contentType);
        }

        try
        {
            var proxiedResponse = await _httpClient.SendAsync(requestMessage, HttpCompletionOption.ResponseHeadersRead);

            var responseBytes = proxiedResponse.Content != null
                ? await proxiedResponse.Content.ReadAsByteArrayAsync()
                : Array.Empty<byte>();

            var contentType = proxiedResponse.Content?.Headers.ContentType?.ToString()?.ToLower() ?? "application/octet-stream";

            var blockedHeaders = new[] { "content-disposition", "content-length", "transfer-encoding", "content-encoding" };

            foreach (var header in proxiedResponse.Headers)
            {
                if (blockedHeaders.Contains(header.Key.ToLower())) continue;

                if (header.Key.Equals("Set-Cookie", StringComparison.OrdinalIgnoreCase))
                {
                    foreach (var cookie in header.Value)
                    {
                        Response.Headers.Append("Set-Cookie", cookie);
                    }
                }
                else
                {
                    Response.Headers[header.Key] = header.Value.ToArray();
                }
            }

            if (proxiedResponse.Content != null)
            {
                foreach (var header in proxiedResponse.Content.Headers)
                {
                    if (blockedHeaders.Contains(header.Key.ToLower())) continue;
                    Response.Headers[header.Key] = header.Value.ToArray();
                }
            }

            if (proxiedResponse.Content?.Headers.ContentEncoding.Contains("gzip") == true)
            {
                using var inStream = new MemoryStream(responseBytes);
                using var zip = new GZipStream(inStream, CompressionMode.Decompress);
                using var sr = new StreamReader(zip, Encoding.UTF8);
                var decompressed = await sr.ReadToEndAsync();

                return Content(decompressed, contentType, Encoding.UTF8);
            }

            if (contentType.StartsWith("text/") || contentType.Contains("json") || contentType.Contains("xml") || contentType.Contains("html"))
            {
                var text = Encoding.UTF8.GetString(responseBytes);
                return Content(text, contentType, Encoding.UTF8);
            }

            return File(responseBytes, contentType);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Proxy exception: {ex}");
            return StatusCode(500, $"Proxy exception: {ex.Message}");
        }
    }




    private bool ShouldSkipRequestHeader(string name)
    {
        var skip = new[]
        {
            "Host", "Content-Length", "Connection",
            "Upgrade-Insecure-Requests", "DNT",
            "Sec-Fetch-Dest", "Sec-Fetch-Mode", "Sec-Fetch-Site"
        };
        return skip.Contains(name, StringComparer.OrdinalIgnoreCase);
    }
}
