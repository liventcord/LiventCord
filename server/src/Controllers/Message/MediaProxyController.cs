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
        return await AddMediaUrl(mediaUrl);
    }

    [NonAction]
    public async Task<IActionResult> AddMediaUrl(MediaUrl mediaUrl)
    {
        if (mediaUrl == null)
            return BadRequest("Invalid URL data.");

        _logger.LogInformation("Received Media URL From Proxy Server: {Url}, FileName: {FileName}, FileSize: {FileSize}, IsImage: {IsImage}",
            mediaUrl.Url, mediaUrl.FileName, mediaUrl.FileSize, mediaUrl.IsImage);

        var existing = await _context.MediaUrls.FirstOrDefaultAsync(m => m.Url == mediaUrl.Url);

        if (existing == null)
        {
            await _context.MediaUrls.AddAsync(mediaUrl);
            _logger.LogInformation("Url " + mediaUrl.Url + " is added to db");
        }
        else
        {
            _logger.LogInformation("Url " + mediaUrl.Url + " already exists in db");

        }


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

        var attachments = new List<Attachment>();

        if (messages.Count == 0)
        {
            _logger.LogWarning("No matching message found for URL {Url}. Attachment not created.", mediaUrl.Url);
        }
        else
        {
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
