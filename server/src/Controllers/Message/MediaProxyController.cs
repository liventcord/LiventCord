using LiventCord.Controllers;
using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[Route("api/media")]
[ApiController]
public class MediaProxyController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<MediaProxyController> _logger;

    public MediaProxyController(AppDbContext context, ILogger<MediaProxyController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> PostMediaUrl(
        [FromBody] MediaUrl mediaUrl,
        [FromHeader(Name = "Authorization")] string? token
    )
    {
        if (string.IsNullOrEmpty(SharedAppConfig.AdminKey))
            return Unauthorized();
        if (token != SharedAppConfig.AdminKey)
            return Unauthorized();
        return await AddMediaUrl(mediaUrl);
    }

    [NonAction]
    public async Task<IActionResult> AddMediaUrl(MediaUrl mediaUrl, string? messageId = "")
    {
        if (mediaUrl == null)
            return BadRequest("Invalid URL data.");
        var sanitizedUrl = mediaUrl.Url?.Replace("\n", "").Replace("\r", "");
        var sanitizedFileName = mediaUrl.FileName?.Replace("\n", "").Replace("\r", "");
        var sanitizedFileSize = mediaUrl.FileSize.ToString().Replace("\n", "").Replace("\r", "");
        _logger.LogInformation(
            "Received Media URL From Proxy Server: {Url}, FileName: {FileName}, FileSize: {FileSize}, IsImage: {IsImage}",
            sanitizedUrl,
            sanitizedFileName,
            sanitizedFileSize,
            mediaUrl.IsImage
        );

        var existing = await _context.MediaUrls.FirstOrDefaultAsync(m => m.Url == mediaUrl.Url);

        if (existing == null && mediaUrl.Url != null)
        {
            await _context.MediaUrls.AddAsync(mediaUrl);
            _logger.LogInformation(
                "Url " + mediaUrl.Url.Replace("\n", "").Replace("\r", "") + " is added to db"
            );
        }
        else if (mediaUrl.Url != null)
        {
            _logger.LogInformation(
                "Url " + mediaUrl.Url.Replace("\n", "").Replace("\r", "") + " already exists in db"
            );
        }

        var attachments = new List<Attachment>();
        List<Message> messages = new();

        if (!string.IsNullOrEmpty(messageId))
        {
            var message = await _context
                .Messages.Include(m => m.Attachments)
                .FirstOrDefaultAsync(m => m.MessageId == messageId);

            if (message != null)
                messages = new List<Message> { message };
            else
                messages = new List<Message>();
        }
        else if (mediaUrl.Url != null)
        {
            var messageIds = await _context
                .MessageUrls.Where(mu => mu.Urls != null && mu.Urls.Contains(mediaUrl.Url))
                .Select(mu => mu.MessageId)
                .Distinct()
                .ToListAsync();

            _logger.LogInformation(
                "Found {Count} message(s) referencing this media URL",
                messageIds.Count
            );

            messages = await _context
                .Messages.Where(m => messageIds.Contains(m.MessageId))
                .Include(m => m.Attachments)
                .ToListAsync();
        }

        if (messages.Count == 0 && mediaUrl.Url != null)
        {
            _logger.LogWarning(
                "No matching message found for URL {Url}. Attachment not created.",
                mediaUrl.Url.Replace("\n", "").Replace("\r", "")
            );
        }
        else if (mediaUrl.Url != null)
        {
            foreach (var msg in messages)
            {
                var attachment = new Attachment
                {
                    FileId = Utils.CreateRandomId(),
                    IsImageFile = mediaUrl.IsImage,
                    IsVideoFile = mediaUrl.IsVideo,
                    MessageId = msg.MessageId,
                    FileName = mediaUrl.FileName ?? mediaUrl.Url,
                    FileSize = mediaUrl.FileSize,
                    IsSpoiler = false,
                    IsProxyFile = true,
                    ProxyUrl = mediaUrl.Url,
                };
                msg.Attachments ??= new List<Attachment>();
                msg.Attachments.Add(attachment);
                attachments.Add(attachment);
            }
        }

        _context.Attachments.AddRange(attachments);
        try
        {
            await _context.SaveChangesAsync();
            _logger.LogInformation("Media URL saved and attachments added successfully");
            return Created();
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Error occurred while saving media URL");
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }
}
