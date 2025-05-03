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
    public async Task<IActionResult> PostMediaUrl([FromBody] MediaUrl mediaUrl)
    {
        if (mediaUrl == null)
        {
            _logger.LogWarning("Request body is null");
            return BadRequest("Invalid URL data.");
        }

        _logger.LogInformation("Received Media URL From Proxy Server: {Url}, FileName: {FileName}, FileSize: {FileSize}, IsImage: {IsImage}",
            mediaUrl.Url, mediaUrl.FileName, mediaUrl.FileSize, mediaUrl.IsImage);

        _context.MediaUrls.Add(mediaUrl);

        var messageIds = await _context.MessageUrls
            .Where(mu => mu.Urls != null && mu.Urls.Contains(mediaUrl.Url))
            .Select(mu => mu.MessageId)
            .Distinct()
            .ToListAsync();

        _logger.LogInformation("Found {Count} message(s) referencing this media URL", messageIds.Count);

        var messages = await _context.Messages
            .Where(m => messageIds.Contains(m.MessageId))
            .Include(m => m.Attachments)
            .ToListAsync();

        foreach (var msg in messages)
        {
            var attachment = new Attachment
            {
                FileId = Utils.CreateRandomId(),
                IsImageFile = mediaUrl.IsImage,
                MessageId = msg.MessageId,
                FileName = mediaUrl.FileName,
                FileSize = mediaUrl.FileSize,
                IsSpoiler = false,
                IsProxyFile = true,
                ProxyUrl = mediaUrl.Url
            };

            if (msg.Attachments == null)
                msg.Attachments = new List<Attachment>();

            msg.Attachments.Add(attachment);
            _context.Attachments.Add(attachment);
        }

        try
        {
            await _context.SaveChangesAsync();
            _logger.LogInformation("Media URL saved and attachments added successfully");
            return CreatedAtAction(nameof(PostMediaUrl), new { url = mediaUrl.Url }, mediaUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while saving media URL");
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }
}
