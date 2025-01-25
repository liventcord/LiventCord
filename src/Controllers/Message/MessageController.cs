using System.ComponentModel.DataAnnotations;
using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [ApiController]
    [Authorize]
    [Route("")]
    public class MessageController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly PermissionsController _permissionsController;
        private readonly MetadataService _metadataService;

        public MessageController(
            AppDbContext context,
            PermissionsController permissionsController,
            MetadataService metadataService
        )
        {
            _permissionsController = permissionsController;
            _context = context;
            _metadataService = metadataService;
        }

        [HttpPost("/api/guilds/{guildId}/channels/{channelId}/messages")]
        public async Task<IActionResult> HandleNewGuildMessage(
            [FromRoute] string guildId,
            [FromRoute] string channelId,
            [FromBody] NewMessageRequest request
        )
        {
            return await HandleMessage("guilds", guildId, channelId, request);
        }

        [HttpPost("/api/dms/{channelId}/messages")]
        public async Task<IActionResult> HandleNewDmMessage(
            [FromRoute] string channelId,
            [FromBody] NewMessageRequest request
        )
        {
            return await HandleMessage("dms", null, channelId, request);
        }

        private async Task<IActionResult> HandleMessage(
            string mode,
            string? guildId,
            string channelId,
            NewMessageRequest request
        )
        {
            if (string.IsNullOrEmpty(channelId) || string.IsNullOrEmpty(request.Content))
            {
                return BadRequest(
                    new
                    {
                        Type = "error",
                        Message = "Required properties (channelId, content) are missing.",
                    }
                );
            }

            if (mode == "guilds")
            {
                if (string.IsNullOrWhiteSpace(guildId))
                {
                    return BadRequest(
                        new { Type = "error", Message = "Missing guildId for guild mode." }
                    );
                }
                if (!await _permissionsController.CanSendMessages(UserId!, guildId))
                {
                    return Forbid();
                }
            }

            await NewMessage(
                UserId!,
                guildId,
                channelId,
                request.Content,
                request.AttachmentUrls,
                request.ReplyToId,
                request.ReactionEmojisIds
            );

            return Ok(new { Type = "success", Message = $"Message sent to {mode}." });
        }

        [HttpGet("/api/{mode:regex(guilds|dms)}/{guildId?}/channels/{channelId}/messages")]
        public async Task<IActionResult> HandleGetMessages(
            [FromRoute] string mode,
            [FromRoute] string channelId,
            [FromRoute] string? guildId = null
        )
        {
            if (mode == "guilds" && string.IsNullOrWhiteSpace(guildId))
            {
                return BadRequest(
                    new { Type = "error", Message = "Missing guildId for guild mode." }
                );
            }

            var messages = await GetMessages(channelId, guildId);
            return Ok(new { messages });
        }

        [HttpPut("/api/{mode:regex(guilds|dms)}/{guildId?}/channels/{channelId}/messages/edit")]
        public async Task<IActionResult> HandleEditMessage(
            [FromRoute] string mode,
            [FromRoute] string targetId,
            [FromRoute] string channelId,
            [FromBody] EditMessageRequest request
        )
        {
            if (string.IsNullOrEmpty(request.Content))
            {
                return BadRequest(new { Type = "error", Message = "Content is required." });
            }

            if (mode == "guilds")
            {
                if (string.IsNullOrEmpty(targetId))
                {
                    return BadRequest(
                        new { Type = "error", Message = "Missing guildId for guild mode." }
                    );
                }

                if (!await _permissionsController.CanManageChannels(UserId!, targetId))
                {
                    return Forbid();
                }

                await EditMessage(channelId, request.MessageId, request.Content);
                return Ok(new { Type = "success", Message = "Message edited in guild." });
            }
            else if (mode == "dms")
            {
                if (!string.IsNullOrEmpty(targetId))
                {
                    return BadRequest(
                        new
                        {
                            Type = "error",
                            Message = "guildId should not be provided for DM mode.",
                        }
                    );
                }

                await EditMessage(channelId, request.MessageId, request.Content);
                return Ok(new { Type = "success", Message = "Message edited in DM." });
            }
            else
            {
                return BadRequest(new { Type = "error", Message = "Invalid mode." });
            }
        }

        // Search Messages (Guild only)
        [HttpGet("/api/guilds/{guildId}/search")]
        public async Task<ActionResult<IEnumerable<Message>>> SearchMessages(
            [FromRoute] string guildId,
            [FromBody] string query
        )
        {
            if (string.IsNullOrWhiteSpace(query))
                return BadRequest("Query cannot be empty.");

            try
            {
                var results = await _context
                    .Messages.FromSqlInterpolated(
                        $"SELECT * FROM messages WHERE guild_id = {guildId} AND search_vector @@ to_tsquery('english', {query})"
                    )
                    .ToListAsync();

                if (results.Count == 0)
                    return NotFound("No messages found matching your query.");

                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred while searching: {ex.Message}");
            }
        }

        [NonAction]
        private async Task<List<Message>> GetMessages(string channelId, string? guildId = null)
        {
            IQueryable<Message> query = _context.Messages.Where(m => m.ChannelId == channelId);

            if (!string.IsNullOrEmpty(guildId))
            {
                query = query.Where(m => m.Channel.GuildId == guildId);
            }

            return await query.OrderBy(m => m.Date).Take(50).ToListAsync();
        }

        [NonAction]
        private async Task NewMessage(
            string userId,
            string targetId,
            string channelId,
            string content,
            string? attachmentUrls,
            string? replyToId,
            string? reactionEmojisIds
        )
        {
            Metadata metadata = new();

            if (Uri.IsWellFormedUriString(content, UriKind.Absolute))
            {
                var fetchedMetadata = await _metadataService.ExtractMetadataAsync(content);
                metadata = new Metadata
                {
                    Title = fetchedMetadata.Title,
                    Description = fetchedMetadata.Description,
                    SiteName = fetchedMetadata.SiteName,
                };
            }

            var message = new Message
            {
                MessageId = Utils.CreateRandomId(),
                UserId = userId,
                Content = content,
                ChannelId = channelId,
                Date = DateTime.UtcNow,
                LastEdited = null,
                AttachmentUrls = attachmentUrls,
                ReplyToId = replyToId,
                ReactionEmojisIds = reactionEmojisIds,
                Metadata = metadata,
            };

            await _context.Messages.AddAsync(message);
            await _context.SaveChangesAsync();
        }

        [NonAction]
        private async Task EditMessage(string channelId, string messageId, string newContent)
        {
            var message = await _context.Messages.FirstOrDefaultAsync(m =>
                m.MessageId == messageId && m.ChannelId == channelId
            );

            if (message != null)
            {
                message.Content = newContent;
                message.LastEdited = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        private async Task DeleteMessagesFromUser(string userId)
        {
            var messages = await _context.Messages.Where(m => m.UserId == userId).ToListAsync();

            if (messages.Any())
            {
                _context.Messages.RemoveRange(messages);
                await _context.SaveChangesAsync();
            }
        }

        private async Task DeleteMessage(string channelId, string messageId)
        {
            var message = await _context.Messages.FirstOrDefaultAsync(m =>
                m.MessageId == messageId && m.ChannelId == channelId
            );

            if (message != null)
            {
                _context.Messages.Remove(message);
                await _context.SaveChangesAsync();
            }
        }
    }
}

public class NewMessageRequest
{
    [StringLength(2000, ErrorMessage = "Content must not exceed 2000 characters.")]
    public required string? Content { get; set; }
    public string? AttachmentUrls { get; set; }
    public string? ReplyToId { get; set; }
    public string? ReactionEmojisIds { get; set; }
    public string? LastEdited { get; set; }
}

public class EditMessageRequest
{
    [IdLengthValidation]
    [Required(ErrorMessage = "GuildId is required.")]
    public required string GuildId { get; set; }

    [IdLengthValidation]
    [Required(ErrorMessage = "MessageId is required.")]
    public required string MessageId { get; set; }

    [IdLengthValidation]
    [Required(ErrorMessage = "ChannelId is required.")]
    public required string ChannelId { get; set; }

    [Required(ErrorMessage = "Content is required.")]
    [StringLength(2000, ErrorMessage = "Content must not exceed 2000 characters.")]
    public required string Content { get; set; }

    public string? AttachmentUrls { get; set; }
}
