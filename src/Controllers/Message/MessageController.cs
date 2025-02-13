using System.ComponentModel.DataAnnotations;
using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [ApiController]
    [Route("")]
    public class MessageController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly PermissionsController _permissionsController;
        private readonly MetadataService _metadataService;
        private readonly ITokenValidationService _tokenValidationService;


        public MessageController(
            AppDbContext context,
            PermissionsController permissionsController,
            MetadataService metadataService, ITokenValidationService tokenValidationService
        )
        {
            _tokenValidationService = tokenValidationService;
            _permissionsController = permissionsController;
            _context = context;
            _metadataService = metadataService;

        }

        [HttpGet("/api/guilds/{guildId}/channels/{channelId}/messages")]
        public async Task<IActionResult> HandleGetGuildMessages(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId
        )
        {
            bool userExists = await _context.DoesMemberExistInGuild(UserId!, guildId);
            if (!userExists)
            {
                return NotFound();
            }
            var messages = await GetMessages(channelId, guildId);
            var oldestMessageDate = messages.Any() ? messages.Min(m => m.Date) : (DateTime?)null;
            return Ok(new { messages, channelId, guildId, oldestMessageDate });
        }

        [HttpGet("/api/dms/channels/{channelId}/messages")]
        public async Task<IActionResult> HandleGetDMMessages([FromRoute] string channelId)
        {
            var messages = await GetMessages(channelId, null);
            var oldestMessageDate = messages.Any() ? messages.Min(m => m.Date) : (DateTime?)null;
            return Ok(new { messages, channelId, oldestMessageDate });
        }

        [HttpPost("/api/discord/bot/messages/{guildId}/{channelId}")]
        public async Task<IActionResult> HandleNewBotMessage(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromBody] NewBotMessageRequest request,
            [FromHeader(Name = "Authorization")] string token
        )
        {
            if (!ModelState.IsValid)
                return BadRequest();

            if (!_tokenValidationService.ValidateToken(token))
            {
                return Unauthorized();
            }

            return await HandleBotMessage(guildId, channelId, request);
        }


        [HttpPost("/api/guilds/{guildId}/channels/{channelId}/messages")]
        public async Task<IActionResult> HandleNewGuildMessage(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromBody] NewMessageRequest request
        )
        {
            return await HandleMessage("guilds", guildId, channelId, request);
        }

        [HttpPost("/api/dms/channels/{channelId}/messages")]
        public async Task<IActionResult> HandleNewDmMessage(
            [IdLengthValidation][FromRoute] string channelId,
            [FromBody] NewMessageRequest request
        )
        {
            return await HandleMessage("dms", null, channelId, request);
        }
        private async Task<IActionResult> HandleBotMessage(
            string guildId,
            string channelId,
            NewBotMessageRequest request
        )
        {

            bool messageExists = await MessageExists(request.MessageId, channelId);
            if (messageExists)
            {
                return Conflict();
            }
            await NewBotMessage(
                request, channelId, guildId
            );

            return Ok(new { Type = "success", Message = $"Message inserted to guild." });
        }



        [HttpPut("/api/guilds/{guildId}/channels/{channelId}/messages/{messageId}")]
        public async Task<IActionResult> HandleEditGuildMessage(
            [FromRoute] string guildId,
            [FromRoute] string channelId,
            [FromRoute] string messageId,
            [FromBody] EditMessageRequest request
        )
        {
            if (string.IsNullOrEmpty(request.Content))
            {
                return BadRequest(new { Type = "error", Message = "Content is required." });
            }

            if (!await _permissionsController.CanManageChannels(UserId!, guildId))
            {
                return Forbid();
            }

            await EditMessage(channelId, messageId, request.Content);
            return Ok(new { Type = "success", Message = "Message edited in guild." });
        }

        [HttpPut("/api/dms/channels/{channelId}/messages/{messageId}")]
        public async Task<IActionResult> HandleEditDMMessage(
            [IdLengthValidation][FromRoute] string channelId,
            [IdLengthValidation][FromRoute] string messageId,
            [FromBody] EditMessageRequest request
        )
        {
            if (string.IsNullOrEmpty(request.Content))
            {
                return BadRequest(new { Type = "error", Message = "Content is required." });
            }

            await EditMessage(channelId, messageId, request.Content);
            return Ok(new { Type = "success", Message = "Message edited in DM." });
        }

        [HttpDelete("/api/guilds/{guildId}/channels/{channelId}/messages/{messageId}")]
        public async Task<IActionResult> HandleDeleteGuildMessage(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [IdLengthValidation][FromRoute] string messageId
        )
        {
            if (!await _permissionsController.CanManageChannels(UserId!, guildId))
            {
                return Forbid();
            }

            await DeleteMessage(channelId, messageId);
            return Ok(new { Type = "success", Message = "Message deleted in guild." });
        }

        [HttpDelete("/api/dms/channels/{channelId}/messages/{messageId}")]
        public async Task<IActionResult> HandleDeleteDMMessage(
            [IdLengthValidation][FromRoute] string channelId,
            [IdLengthValidation][FromRoute] string messageId
        )
        {
            await DeleteMessage(channelId, messageId);
            return Ok(new { Type = "success", Message = "Message deleted in DM." });
        }

        [HttpGet("/api/{type}/{id}/search")]
        public async Task<ActionResult<IEnumerable<Message>>> SearchMessages(
            [FromRoute] string type,
            [IdLengthValidation][FromRoute] string id,
            [FromBody] string query
        )
        {
            if (string.IsNullOrWhiteSpace(query))
                return BadRequest("Query cannot be empty.");

            type = type.ToLower();

            try
            {
                List<Message> results;

                if (type == "guilds")
                {
                    results = await _context
                        .Messages.Where(m => m.Channel.GuildId == id)
                        .Where(m => m.Content != null && EF.Functions.ToTsVector("english", m.Content).Matches(query))
                        .ToListAsync();
                }
                else if (type == "dms")
                {
                    results = await _context
                        .Messages.Where(m => m.ChannelId == id)
                        .Where(m => m.Content != null && EF.Functions.ToTsVector("english", m.Content).Matches(query))
                        .ToListAsync();
                }
                else
                {
                    return BadRequest("Invalid type. It must be 'guilds' or 'dms'.");
                }

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
            return await _context.Messages
                .Where(m => m.ChannelId == channelId && (guildId == null || m.Channel.GuildId == guildId))
                .OrderBy(m => m.Date)
                .Take(50)
                .AsNoTracking()
                .ToListAsync();
        }


        [NonAction]
        private async Task NewBotMessage(NewBotMessageRequest request, string channelId, string guildId)
        {
            var embeds = request.Embeds ?? new List<Embed>();

            foreach (var embed in embeds)
            {
                if (string.IsNullOrEmpty(embed.Id))
                {
                    embed.Id = Utils.CreateRandomId();
                }
            }

            await NewMessage(
                request.MessageId,
                request.UserId,
                channelId,
                request.Content,
                request.Date,
                request.LastEdited,
                request.AttachmentUrls,
                request.ReplyToId,
                request.ReactionEmojisIds,
                embeds
            );
        }


        [NonAction]
        private async Task NewMessage(
             string messageId,
             string userId,
             string channelId,
             string? content,
             DateTime date,
             DateTime? lastEdited,
             string? attachmentUrls,
             string? replyToId,
             string? reactionEmojisIds,
             List<Embed>? embeds)
        {
            var userExists = await _context.Users.AnyAsync(u => u.UserId == userId);
            if (!userExists)
            {
                User newUser = _context.CreateDummyUser(userId);
                await _context.Users.AddAsync(newUser);
                await _context.SaveChangesAsync();
            }

            var channelExists = await _context.Channels.AnyAsync(c => c.ChannelId == channelId);
            if (!channelExists)
            {
                return;
            }

            if (!string.IsNullOrEmpty(replyToId) && !await _context.Messages.AnyAsync(m => m.MessageId == replyToId))
            {
                return;
            }

            await Task.Run(async () =>
            {
                var metadata = await ExtractMetadataIfUrl(content).ConfigureAwait(false);
                await SaveMetadataAsync(messageId, metadata);
            });

            var message = new Message
            {
                MessageId = messageId,
                UserId = userId,
                Content = content,
                ChannelId = channelId,
                Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
                LastEdited = lastEdited.HasValue ? DateTime.SpecifyKind(lastEdited.Value, DateTimeKind.Utc) : null,
                AttachmentUrls = attachmentUrls,
                ReplyToId = replyToId,
                ReactionEmojisIds = reactionEmojisIds,
                Embeds = embeds ?? new(),
                Metadata = new Metadata()
            };

            await _context.Messages.AddAsync(message).ConfigureAwait(false);
            await _context.SaveChangesAsync().ConfigureAwait(false);
        }

        private async Task SaveMetadataAsync(string messageId, Metadata metadata)
        {
            var message = await _context.Messages.FirstOrDefaultAsync(m => m.MessageId == messageId);
            if (message != null)
            {
                message.Metadata = metadata;
                await _context.SaveChangesAsync();
            }
        }

        [NonAction]
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

            if (!string.IsNullOrEmpty(request.ReplyToId) && request.ReplyToId.Length != Utils.ID_LENGTH)
            {
                return BadRequest(
                    new
                    {
                        Type = "error",
                        Message = $"Reply id should be {Utils.ID_LENGTH} characters long",
                    }
                );
            }

            if (mode == "guilds")
            {
                if (string.IsNullOrWhiteSpace(guildId))
                {
                    return BadRequest(new { Type = "error", Message = "Missing guildId" });
                }
                if (!await _permissionsController.CanSendMessages(UserId!, guildId))
                {
                    return Forbid();
                }
            }

            await NewMessage(
                Utils.CreateRandomId(),
                UserId!,
                channelId,
                request.Content,
                DateTime.UtcNow,
                null,
                request.AttachmentUrls,
                request.ReplyToId,
                null,
                null
            );

            return Ok(new { Type = "success", Message = $"Message sent to {mode}." });
        }

        [NonAction]
        private async Task<bool> MessageExists(string messageId, string channelId)
        {
            var message = await _context.Messages.FirstOrDefaultAsync(m =>
                m.MessageId == messageId && m.ChannelId == channelId
            );
            return message != null;
        }

        private async Task<Metadata> ExtractMetadataIfUrl(string? content)
        {
            if (!Uri.IsWellFormedUriString(content, UriKind.Absolute))
                return new Metadata();


            var fetchedMetadata = await _metadataService.ExtractMetadataAsync(content);
            return new Metadata
            {
                Title = fetchedMetadata.Title,
                Description = fetchedMetadata.Description,
                SiteName = fetchedMetadata.SiteName
            };
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
public class NewBotMessageRequest
{
    [IdLengthValidation]
    public required string MessageId { get; set; }
    public required string UserId { get; set; }
    public string? Content { get; set; }
    public required DateTime Date { get; set; }
    public DateTime? LastEdited { get; set; }
    public string? AttachmentUrls { get; set; }
    public string? ReplyToId { get; set; }
    public string? ReactionEmojisIds { get; set; }
    public List<Embed>? Embeds { get; set; } = new List<Embed>();

}

public class NewMessageRequest
{
    [StringLength(2000, ErrorMessage = "Content must not exceed 2000 characters.")]
    public required string Content { get; set; }
    [StringLength(300)]
    public string? AttachmentUrls { get; set; }
    public string? ReplyToId { get; set; }

}
public class EditMessageRequest
{
    [IdLengthValidation]
    [Required]
    public required string GuildId { get; set; }

    [IdLengthValidation]
    [Required]
    public required string MessageId { get; set; }

    [IdLengthValidation]
    [Required]
    public required string ChannelId { get; set; }

    [Required]
    [StringLength(2000, ErrorMessage = "Content must not exceed 2000 characters.")]
    public required string Content { get; set; }

    public string? AttachmentUrls { get; set; }
}