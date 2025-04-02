using System.ComponentModel.DataAnnotations;
using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
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

        private readonly ImageController _imageController;
        private readonly RedisEventEmitter _redisEventEmitter;
        private readonly ChannelController _channelController;

        private readonly ILogger<MessageController> _logger;

        public MessageController(
            AppDbContext context,
            PermissionsController permissionsController,
            MetadataService metadataService, ITokenValidationService tokenValidationService, ImageController imageController, RedisEventEmitter redisEventEmitter, ILogger<MessageController> logger, ChannelController channelController
        )
        {
            _tokenValidationService = tokenValidationService;
            _permissionsController = permissionsController;
            _context = context;
            _metadataService = metadataService;
            _imageController = imageController;
            _redisEventEmitter = redisEventEmitter;
            _logger = logger;
            _channelController = channelController;

        }
        [Authorize]
        [HttpGet("/api/guilds/{guildId}/channels/{channelId}/messages")]
        public async Task<IActionResult> HandleGetGuildMessages(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromQuery] string? date,
            [FromQuery] string? messageId
        )
        {
            bool userExists = await _context.DoesMemberExistInGuild(UserId!, guildId);
            if (!userExists)
            {
                return NotFound();
            }

            DateTime? parsedDate = null;
            if (date != null)
            {
                if (!DateTime.TryParse(date, out DateTime tempParsedDate))
                {
                    return BadRequest("Invalid date format.");
                }
                parsedDate = tempParsedDate;
            }

            var messages = await GetMessages(parsedDate?.ToString("o"), UserId!, null, channelId, guildId, messageId);
            var oldestMessageDate = messages.Any() ? messages.Min(m => m.Date) : (DateTime?)null;
            bool isOldMessages = date != null;
            return Ok(new { messages, channelId, guildId, oldestMessageDate, isOldMessages });
        }
        [Authorize]
        [HttpGet("/api/dms/channels/{friendId}/messages")]
        public async Task<IActionResult> HandleGetDMMessages(
            [UserIdLengthValidation][FromRoute] string friendId,
            [FromQuery] string? date,
            [FromQuery] string? messageId,
            [FromQuery] string? guildId
        )
        {
            var userId = UserId!;
            var constructedFriendUserChannel = string.Compare(userId, friendId) < 0
                ? $"{userId}_{friendId}"
                : $"{friendId}_{userId}";

            DateTime? parsedDate = null;
            if (date != null)
            {
                if (!DateTime.TryParse(date, out DateTime tempParsedDate))
                {
                    return BadRequest("Invalid date format.");
                }
                parsedDate = tempParsedDate;
            }

            var messages = await GetMessages(parsedDate?.ToString("o"), UserId!, friendId, null, guildId, messageId);
            var oldestMessageDate = messages.Any() ? messages.Min(m => m.Date) : (DateTime?)null;
            bool isOldMessages = date != null;
            return Ok(new { messages, channelId = constructedFriendUserChannel, oldestMessageDate, isOldMessages });
        }


        [Authorize]

        [HttpPost("/api/guilds/{guildId}/channels/{channelId}/messages")]
        public async Task<IActionResult> HandleNewGuildMessage(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromForm] NewMessageRequest request
        )
        {
            return await HandleMessage(MessageType.Guilds, guildId, channelId, UserId!, request);
        }
        [Authorize]

        [HttpPost("/api/dms/channels/{friendId}/messages")]
        public async Task<IActionResult> HandleNewDmMessage(
            [UserIdLengthValidation][FromRoute] string friendId,
            [FromForm] NewMessageRequest request
        )
        {
            var userId = UserId!;


            var constructedFriendUserChannel = string.Compare(userId, friendId) < 0 ? $"{userId}_{friendId}" : $"{friendId}_{userId}";


            var channelExists = await _context.Channels.AnyAsync(c => c.ChannelId == constructedFriendUserChannel);
            if (!channelExists)
            {
                await _channelController.CreateChannelInternal(userId, friendId, constructedFriendUserChannel, constructedFriendUserChannel, true, false, constructedFriendUserChannel, false);
            }


            return await HandleMessage(
                MessageType.Dms,
                null,
                constructedFriendUserChannel,
                UserId!,
                request
            );
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

            return await ProcessMessage(guildId, channelId, request);
        }

        [HttpPost("/api/discord/bot/messages/bulk/{guildId}/{channelId}")]
        public async Task<IActionResult> HandleBulkMessages(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromBody] List<NewBotMessageRequest> requests,
            [FromHeader(Name = "Authorization")] string token
        )
        {
            if (!ModelState.IsValid)
                return BadRequest();

            if (!_tokenValidationService.ValidateToken(token))
            {
                return Unauthorized();
            }

            var messagesToAddOrUpdate = new List<Message>();

            foreach (var request in requests)
            {
                var message = await _context.Messages
                    .Include(m => m.Embeds)
                    .FirstOrDefaultAsync(m => m.MessageId == request.MessageId);

                if (message != null)
                {
                    UpdateMessage(message, request);
                    messagesToAddOrUpdate.Add(message);
                }
                else
                {

                    var newMessage = CreateNewMessage(request, channelId);
                    messagesToAddOrUpdate.Add(newMessage);
                }
            }


            await _context.SaveChangesAsync();

            return Ok(new { Type = "success", Message = "Messages processed successfully." });
        }

        private async Task<IActionResult> ProcessMessage(
            string guildId,
            string channelId,
            NewBotMessageRequest request
        )
        {
            var message = await _context.Messages
                .Include(m => m.Embeds)
                .FirstOrDefaultAsync(m => m.MessageId == request.MessageId);

            if (message != null)
            {
                UpdateMessage(message, request);
                await _context.SaveChangesAsync();
                return Ok(new { Type = "success", Message = "Message updated in guild." });
            }


            var newMessage = CreateNewMessage(request, channelId);
            _context.Messages.Add(newMessage);
            await _context.SaveChangesAsync();
            return Ok(new { Type = "success", Message = "Message inserted to guild." });
        }

        private void UpdateMessage(Message message, NewBotMessageRequest request)
        {
            message.Content = request.Content;
            message.LastEdited = DateTime.UtcNow;
            message.AttachmentUrls = request.AttachmentUrls;
            message.ReplyToId = request.ReplyToId;
            message.ReactionEmojisIds = request.ReactionEmojisIds;

            if (request.Embeds != null && request.Embeds.Any())
            {
                message.Embeds.Clear();
                var newEmbeds = request.Embeds.Select(embed =>
                {
                    embed.Id ??= Utils.CreateRandomId();
                    return embed;
                }).ToList();

                message.Embeds.AddRange(newEmbeds);
            }
        }

        private Message CreateNewMessage(NewBotMessageRequest request, string channelId)
        {
            return new Message
            {
                MessageId = request.MessageId,
                Content = request.Content,
                UserId = request.UserId,
                Date = request.Date,
                ChannelId = channelId,
                LastEdited = request.LastEdited,
                AttachmentUrls = request.AttachmentUrls,
                ReplyToId = request.ReplyToId,
                ReactionEmojisIds = request.ReactionEmojisIds,
                Embeds = request.Embeds?.Select(embed =>
                {
                    embed.Id ??= Utils.CreateRandomId();
                    return embed;
                }).ToList() ?? new List<Embed>()
            };
        }






        [Authorize]
        [HttpPut("/api/guilds/{guildId}/channels/{channelId}/messages/{messageId}")]
        public async Task<IActionResult> HandleEditGuildMessage(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string channelId,
            [FromRoute][IdLengthValidation] string messageId,
            [FromForm] EditMessageRequest request
        )
        {
            if (string.IsNullOrEmpty(request.Content))
            {
                return BadRequest(new { Type = "error", Message = "Content is required." });
            }

            if (!await _permissionsController.CanManageChannels(UserId!, guildId))
            {
                return StatusCode(StatusCodes.Status403Forbidden);
            }

            await EditMessage(channelId, messageId, request.Content);
            bool isDm = false;
            var editBroadcast = new { isDm, guildId, channelId, messageId, request.Content };
            await _redisEventEmitter.EmitToGuild(EventType.EDIT_MESSAGE_GUILD, editBroadcast, guildId, UserId!);
            return Ok(editBroadcast);
        }
        [Authorize]
        [HttpPut("/api/dms/channels/{channelId}/messages/{messageId}")]
        public async Task<IActionResult> HandleEditDMMessage(
            [UserIdLengthValidation][FromRoute] string channelId,
            [IdLengthValidation][FromRoute] string messageId,
            [FromBody] EditMessageRequest request
        )
        {
            if (string.IsNullOrEmpty(request.Content))
            {
                return BadRequest(new { Type = "error", Message = "Content is required." });
            }
            var userId = UserId!;
            var constructedFriendUserChannel = string.Compare(userId, channelId) < 0 ? $"{userId}_{channelId}" : $"{channelId}_{userId}";
            await EditMessage(constructedFriendUserChannel, messageId, request.Content);
            bool isDm = true;
            var editBroadcast = new { isDm, constructedFriendUserChannel, messageId, request.Content };
            await _redisEventEmitter.EmitToFriend(EventType.EDIT_MESSAGE_DM, editBroadcast, UserId!, constructedFriendUserChannel);
            return Ok(editBroadcast);
        }
        [Authorize]

        [HttpDelete("/api/guilds/{guildId}/channels/{channelId}/messages/{messageId}")]
        public async Task<IActionResult> HandleDeleteGuildMessage(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [IdLengthValidation][FromRoute] string messageId
        )
        {
            if (!await _permissionsController.CanDeleteMessages(UserId!, guildId))
            {
                return StatusCode(StatusCodes.Status403Forbidden);
            }
            var deleteBroadcast = new { guildId, channelId, messageId };
            await DeleteMessage(channelId, messageId);
            await _redisEventEmitter.EmitToGuild(EventType.DELETE_MESSAGE_GUILD, deleteBroadcast, guildId, UserId!);
            return Ok(deleteBroadcast);
        }
        [Authorize]

        [HttpDelete("/api/dms/channels/{channelId}/messages/{messageId}")]
        public async Task<IActionResult> HandleDeleteDMMessage(
            [UserIdLengthValidation][FromRoute] string channelId,
            [IdLengthValidation][FromRoute] string messageId
        )
        {
            var userId = UserId!;
            var constructedFriendUserChannel = string.Compare(userId, channelId) < 0 ? $"{userId}_{channelId}" : $"{channelId}_{userId}";
            var deleteBroadcast = new { channelId, messageId };
            var foundMessage = await _context.Messages.FirstOrDefaultAsync(m => m.MessageId == messageId);
            if (foundMessage == null)
            {
                return NotFound();
            }
            if (foundMessage.UserId != userId)
            {
                return Forbid();
            }

            await DeleteMessage(constructedFriendUserChannel, messageId);
            return Ok(deleteBroadcast);
        }
        [Authorize]
        [HttpGet("/api/{type}/{id}/search")]
        public async Task<ActionResult<IEnumerable<Message>>> SearchMessages(
            [FromRoute] MessageType type,
            [IdLengthValidation][FromRoute] string id,
            [FromBody] string query)
        {
            if (string.IsNullOrWhiteSpace(query))
                return BadRequest("Query cannot be empty.");

            try
            {
                var results = await SearchMessagesInContext(id, query, type, UserId!);
                if (results == null || !results.Any())
                    return NotFound("No messages found matching your query.");

                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred while searching: {ex.Message}");
            }
        }

        private async Task<List<Message>?> SearchMessagesInContext(string id, string query, MessageType type, string userId)
        {
            IQueryable<Message> queryable = _context.Messages.Where(m => m.Content != null);

            queryable = Utils.IsPostgres(_context)
                ? queryable.Where(m => m.Content != null && EF.Functions.ToTsVector("english", m.Content).Matches(query))
                : queryable.Where(m => m.Content != null && m.Content.Contains(query));

            switch (type)
            {
                case MessageType.Guilds:
                    queryable = queryable.Where(m => m.Channel.GuildId == id);
                    if (!await _context.DoesMemberExistInGuild(userId, id))
                        return null;
                    break;
                case MessageType.Dms:
                    queryable = queryable.Where(m => m.ChannelId == id);
                    if (!await _context.CheckFriendship(userId, id))
                        return null;
                    break;
            }

            return await queryable.ToListAsync();
        }

        [NonAction]
        private async Task<List<Message>> GetMessages(string? date = null, string? userId = null, string? friendId = null, string? channelId = null, string? guildId = null, string? messageId = null)
        {
            IQueryable<Message> query = _context.Messages.AsQueryable();
            DateTime? parsedDate = null;
            if (date != null)
            {
                if (DateTime.TryParse(date, out DateTime tempParsedDate))
                {
                    parsedDate = tempParsedDate.ToUniversalTime();
                }
            }

            if (parsedDate != null)
            {
                query = query.Where(m => m.Date < parsedDate);
            }

            if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(friendId))
            {
                var constructedFriendUserChannel = string.Compare(userId, friendId) < 0
                    ? $"{userId}_{friendId}"
                    : $"{friendId}_{userId}";
                query = query.Where(m => m.ChannelId == constructedFriendUserChannel);
            }
            else if (!string.IsNullOrEmpty(channelId))
            {
                query = query.Where(m => m.ChannelId == channelId);
            }

            if (!string.IsNullOrEmpty(guildId))
            {
                query = query.Where(m => m.Channel.GuildId == guildId);
            }

            if (!string.IsNullOrEmpty(messageId))
            {
                query = query.Where(m => m.MessageId == messageId);
            }

            return await query
                .OrderByDescending(m => m.Date)
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
                null,
                request.UserId,
                channelId,
                guildId,
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
        private async Task<IActionResult> NewMessage(
            string messageId,
            string? temporaryId,
            string userId,
            string channelId,
            string? guildId,
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

            string constructedFriendUserChannel = channelId;
            if (guildId == null)
            {
                var userIds = channelId.Split('_');
                if (userIds.Length != 2 || !userIds.Contains(userId))
                {
                    return BadRequest();
                }

                string recipientId = userIds.First(id => id != userId);
                constructedFriendUserChannel = string.Compare(userId, recipientId) < 0 ? $"{userId}_{recipientId}" : $"{recipientId}_{userId}";
            }

            var channelExists = await _context.Channels.AnyAsync(c => c.ChannelId == constructedFriendUserChannel);
            if (!channelExists)
            {
                if (guildId == null)
                {
                    await _channelController.CreateChannelInternal(userId, null, constructedFriendUserChannel, constructedFriendUserChannel, true, false, constructedFriendUserChannel, false);
                }
                else
                {
                    return BadRequest();
                }
            }

            if (!string.IsNullOrEmpty(replyToId) && !await _context.Messages.AnyAsync(m => m.MessageId == replyToId))
            {
                return BadRequest();
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
                ChannelId = constructedFriendUserChannel,
                Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
                LastEdited = lastEdited.HasValue ? DateTime.SpecifyKind(lastEdited.Value, DateTimeKind.Utc) : null,
                AttachmentUrls = attachmentUrls,
                ReplyToId = replyToId,
                ReactionEmojisIds = reactionEmojisIds,
                Embeds = embeds ?? new List<Embed>(),
                Metadata = new Metadata()
            };
            if (temporaryId != null && temporaryId.Length == Utils.ID_LENGTH)
            {
                message.TemporaryId = temporaryId;
            }

            await _context.Messages.AddAsync(message).ConfigureAwait(false);
            await _context.SaveChangesAsync().ConfigureAwait(false);

            if (guildId != null)
            {
                var broadcastMessage = new
                {
                    guildId,
                    messages = new[] { message },
                    channelId,
                    userId
                };
                await _redisEventEmitter.EmitToGuild(EventType.SEND_MESSAGE_GUILD, broadcastMessage, guildId, userId);
            }

            return Ok(message);
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
             MessageType mode,
             string? guildId,
             string channelId,
             string userId,
             NewMessageRequest request)
        {
            if (mode == MessageType.Guilds)
            {
                if (string.IsNullOrWhiteSpace(guildId))
                {
                    return BadRequest(new { Type = "error", Message = "Missing guildId" });
                }
                if (!await _permissionsController.CanSendMessages(UserId!, guildId))
                {
                    return StatusCode(StatusCodes.Status403Forbidden);
                }
            }

            if (string.IsNullOrEmpty(channelId) || string.IsNullOrEmpty(request.Content))
            {
                return BadRequest(new { Type = "error", Message = "Required properties (channelId, content) are missing." });
            }

            if (!string.IsNullOrEmpty(request.ReplyToId) && request.ReplyToId.Length != Utils.ID_LENGTH)
            {
                return BadRequest(new { Type = "error", Message = $"Reply id should be {Utils.ID_LENGTH} characters long" });
            }

            long MAX_TOTAL_SIZE = SharedAppConfig.GetMaxAttachmentSize();
            long totalSize = 0;
            string attachmentUrls = "";

            if (request.Files != null && request.Files.Any())
            {
                foreach (var file in request.Files)
                {
                    if (file.Length > MAX_TOTAL_SIZE)
                    {
                        return BadRequest(new { Type = "error", Message = "One of the files exceeds the size limit." });
                    }
                    totalSize += file.Length;

                    if (totalSize > MAX_TOTAL_SIZE)
                    {
                        return BadRequest(new { Type = "error", Message = "Total file size exceeds the size limit." });
                    }

                    string fileId = await _imageController.UploadFileInternal(file, userId, false, guildId, channelId);
                    attachmentUrls += fileId + ",";
                }

                attachmentUrls = attachmentUrls.TrimEnd(',');
            }

            var messageId = Utils.CreateRandomId();

            return await NewMessage(
                messageId,
                request.TemporaryId,
                userId,
                channelId,
                guildId,
                request.Content,
                DateTime.UtcNow,
                null,
                attachmentUrls,
                request.ReplyToId,
                null,
                null
            );
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
                foreach (var message in messages)
                {
                    await DeleteMessage(message.ChannelId, message.MessageId);
                }
            }
        }

        private async Task DeleteMessage(string channelId, string messageId)
        {
            var message = await _context.Messages.FirstOrDefaultAsync(m =>
                m.MessageId == messageId && m.ChannelId == channelId
            );
            if (message == null)
            {
                _logger.LogWarning("Message not found for deletion.");
                return;
            }

            try
            {
                await _imageController.DeleteAttachmentFile(message);
                _context.Messages.Remove(message);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Message deleted successfully. ChannelId: {ChannelId}, MessageId: {MessageId}", message.ChannelId, message.MessageId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting message. " + ex.Message);
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
    [BindProperty(Name = "content")]
    [StringLength(2000, ErrorMessage = "Content must not exceed 2000 characters.")]
    public required string Content { get; set; }

    [BindProperty(Name = "files[]")]
    public IEnumerable<IFormFile>? Files { get; set; }

    [BindProperty(Name = "replyToId")]
    public string? ReplyToId { get; set; }
    [BindProperty(Name = "temporaryId")]
    public string? TemporaryId { get; set; }


}



public class EditMessageRequest
{
    [Required]
    [StringLength(2000, ErrorMessage = "Content must not exceed 2000 characters.")]
    public required string Content { get; set; }

}
public enum MessageType
{
    Guilds,
    Dms
}
