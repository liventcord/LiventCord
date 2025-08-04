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
        private readonly MetadataController _metadataService;
        private readonly ITokenValidationService _tokenValidationService;

        private readonly FileController _imageController;
        private readonly RedisEventEmitter _redisEventEmitter;
        private readonly ChannelController _channelController;
        private readonly FriendDmService _friendDmService;
        private readonly ILogger<MessageController> _logger;

        public MessageController(
            AppDbContext context,
            PermissionsController permissionsController,
            MetadataController metadataService, ITokenValidationService tokenValidationService, FileController imageController, RedisEventEmitter redisEventEmitter, ILogger<MessageController> logger, ChannelController channelController, FriendDmService friendDmService
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
            _friendDmService = friendDmService;

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
            var userId = UserId!;
            bool userExists = await _context.DoesMemberExistInGuild(userId, guildId);
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
            var canReadMessages = await _permissionsController.CanReadMessages(userId, guildId);
            if (!canReadMessages)
            {
                return Forbid();
            }

            var messages = await GetMessages(parsedDate?.ToString("o"), userId, null, channelId, guildId, messageId);
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
            var constructedFriendUserChannel = ConstructDmId(userId, friendId);

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
        private async Task<bool> CanUsersDm(string userId, string friendId)
        {
            bool isFriends = await _context.CheckFriendship(userId, friendId);
            bool isSharingGuilds = await _context.AreUsersSharingGuild(userId, friendId);
            if (isFriends || isSharingGuilds)
            {
                return true;
            }
            return false;

        }
        [Authorize]
        [HttpPost("/api/dms/channels/{friendId}/messages")]
        public async Task<IActionResult> HandleNewDmMessage(
            [UserIdLengthValidation][FromRoute] string friendId,
            [FromForm] NewMessageRequest request
        )
        {
            var userId = UserId!;
            bool canUsersDm = await CanUsersDm(userId, friendId);
            if (!canUsersDm)
            {
                return Forbid();
            }

            var constructedFriendUserChannel = ConstructDmId(userId, friendId);


            var channelExists = await _context.Channels.AnyAsync(c => c.ChannelId == constructedFriendUserChannel);
            if (!channelExists)
            {
                await _channelController.CreateChannelInternal(userId, friendId, constructedFriendUserChannel, constructedFriendUserChannel, true, false, constructedFriendUserChannel, false);
            }

            await _friendDmService.AddDmBetweenUsers(userId, friendId);

            return await HandleMessage(
                MessageType.Dms,
                null,
                constructedFriendUserChannel,
                UserId!,
                request
            );
        }



        [HttpPost("/api/discord/bot/messages/{guildId}/{channelId}")]
        [ValidateBotToken]
        public async Task<IActionResult> HandleNewBotMessage(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromBody] NewBotMessageRequest request


        )
        {
            if (!ModelState.IsValid)
                return BadRequest();

            return await ProcessBotMessage(guildId, channelId, request);
        }

        [HttpPost("/api/discord/bot/messages/bulk/{guildId}/{channelId}")]
        [ValidateBotToken]
        public async Task<IActionResult> HandleBulkMessages(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromBody] List<NewBotMessageRequest> requests

        )
        {
            if (!ModelState.IsValid)
                return BadRequest();


            foreach (var request in requests)
            {
                var message = await _context.Messages
                    .Include(m => m.Embeds)
                    .FirstOrDefaultAsync(m => m.MessageId == request.MessageId);

                if (message != null)
                {
                    UpdateMessage(message, request);
                }
                else
                {
                    var newMessage = await CreateNewMessage(request, guildId, channelId);
                    _context.Messages.Add(newMessage);
                }
            }


            await _context.SaveChangesAsync();

            return Ok(new { Type = "success", Message = "Messages processed successfully." });
        }

        private async Task<IActionResult> ProcessBotMessage(
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

            var embeds = request.Embeds ?? new List<Embed>();

            foreach (var embed in embeds)
            {
                if (string.IsNullOrEmpty(embed.Id))
                {
                    embed.Id = Utils.CreateRandomId();
                }
            }

            var newMessage = await CreateNewMessage(request, guildId, channelId);
            _context.Messages.Add(newMessage);
            await _context.SaveChangesAsync();
            return Ok(new { Type = "success", Message = "Message inserted to guild." });
        }
        private List<Attachment> CreateAttachmentsFromUrls(string urls, string messageId)
        {
            List<Attachment> attachments = new();
            List<string> parsedUrls = urls.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

            foreach (var url in parsedUrls)
            {
                var fileName = url;
                var fileId = Utils.CreateRandomId();
                var fileSize = 0;
                var isImage = true;
                var isVideo = true;
                var isSpoiler = false;

                var attachment = new Attachment
                {
                    FileId = fileId,
                    IsImageFile = isImage,
                    IsVideoFile = isVideo,
                    MessageId = messageId,
                    FileName = fileName,
                    FileSize = fileSize,
                    IsSpoiler = isSpoiler
                };

                attachments.Add(attachment);
            }

            return attachments;
        }

        private void UpdateMessage(Message message, NewBotMessageRequest request)
        {
            message.Content = request.Content;
            message.LastEdited = DateTime.UtcNow;
            if (request.AttachmentUrls != null)
            {
                message.Attachments = CreateAttachmentsFromUrls(request.AttachmentUrls, message.MessageId);

            }
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

        private async Task<Message> CreateNewMessage(NewBotMessageRequest request, string guildId, string channelId)
        {
            if (request.Content != null)
            {
                await Task.Run(async () =>
                {
                    var urls = await HandleMessageUrls(guildId, channelId, request.UserId, request.MessageId, request.Content);
                    try
                    {
                        var metadata = await ExtractMetadataIfUrl(urls, request.MessageId);
                        await SaveMetadataAsync(request.MessageId, metadata);
                    }
                    catch (Exception ex)
                    {
                        var sanitizedMessageId = Utils.SanitizeLogInput(request.MessageId);
                        _logger.LogError(ex, "Failed to extract or save metadata for message: {MessageId}", sanitizedMessageId);
                    }
                });
            }

            return new Message
            {
                MessageId = request.MessageId,
                Content = request.Content,
                UserId = request.UserId,
                Date = request.Date,
                ChannelId = channelId,
                LastEdited = request.LastEdited,
                Attachments = request.AttachmentUrls != null ? CreateAttachmentsFromUrls(request.AttachmentUrls, request.MessageId) : null,
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
            [FromBody] EditMessageRequest request
        )
        {
            var userId = UserId!;
            await EditMessage(userId, channelId, messageId, request.Content);
            bool isDm = false;
            var editBroadcast = new { isDm, guildId, channelId, messageId, request.Content };
            await _redisEventEmitter.EmitToGuild(EventType.EDIT_MESSAGE_GUILD, editBroadcast, guildId, userId);
            return Ok(editBroadcast);
        }
        [Authorize]
        [HttpPut("/api/dms/channels/{friendId}/messages/{messageId}")]
        public async Task<IActionResult> HandleEditDMMessage(
            [UserIdLengthValidation][FromRoute] string friendId,
            [IdLengthValidation][FromRoute] string messageId,
            [FromBody] EditMessageRequest request
        )
        {
            var userId = UserId!;
            var constructedFriendUserChannel = ConstructDmId(userId, friendId);
            await EditMessage(userId, constructedFriendUserChannel, messageId, request.Content);
            bool isDm = true;
            var editBroadcast = new { isDm, constructedFriendUserChannel, messageId, request.Content };
            await _redisEventEmitter.EmitToFriend(EventType.EDIT_MESSAGE_DM, editBroadcast, userId, constructedFriendUserChannel);
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
            var foundMessage = await _context.Messages.FirstOrDefaultAsync(m => m.MessageId == messageId && m.ChannelId == channelId);
            if (foundMessage == null)
            {
                return Forbid();
            }

            if (!await _permissionsController.CanDeleteMessages(UserId!, guildId, foundMessage.UserId))
            {
                return Forbid();
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
            var constructedFriendUserChannel = ConstructDmId(userId, channelId);
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
        private string ConstructDmId(string userId, string friendId)
        {
            return string.Compare(userId, friendId) < 0 ? $"{userId}_{friendId}" : $"{friendId}_{userId}";
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
                    queryable = queryable.Where(m => m.ChannelId == ConstructDmId(userId, id));
                    bool canUsersDm = await CanUsersDm(userId, id);
                    if (!canUsersDm)
                    {
                        return null;
                    }

                    break;
            }

            return await queryable.ToListAsync();
        }
        [NonAction]
        private async Task<List<Message>> GetMessages(string? date = null, string? userId = null, string? friendId = null, string? channelId = null, string? guildId = null, string? messageId = null)
        {
            DateTime? parsedDate = null;

            if (date != null && DateTime.TryParse(date, out DateTime tempParsedDate))
            {
                parsedDate = tempParsedDate.ToUniversalTime();
            }


            var query = _context.Messages
                .Include(m => m.Attachments)
                .Include(m => m.Channel)
                .AsQueryable();

            if (parsedDate != null)
                query = query.Where(m => m.Date < parsedDate);

            if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(friendId))
            {
                var constructedFriendUserChannel = ConstructDmId(userId, friendId);
                query = query.Where(m => m.ChannelId == constructedFriendUserChannel);
            }
            else if (!string.IsNullOrEmpty(channelId))
            {
                query = query.Where(m => m.ChannelId == channelId);
            }

            if (!string.IsNullOrEmpty(guildId))
                query = query.Where(m => m.Channel.GuildId == guildId);

            if (!string.IsNullOrEmpty(messageId))
                query = query.Where(m => m.MessageId == messageId);

            var result = await query
                .OrderByDescending(m => m.Date)
                .Take(50)
                .Select(m => new
                {
                    Message = m,
                    IsPinned = _context.ChannelPinnedMessages.Any(pm => pm.MessageId == m.MessageId)
                })
                .AsNoTracking()
                .ToListAsync();

            foreach (var item in result)
            {
                item.Message.IsPinned = item.IsPinned;

                if (!item.Message.ShouldSerializeMetadata())
                {
                    item.Message.Metadata = null;
                }
            }

            return result.Select(r => r.Message).ToList();

        }


        [NonAction]
        private async Task<IActionResult?> ValidateNewMessage(
            string userId,
            string channelId,
            string? guildId,
            string? replyToId)
        {
            var userExists = await _context.Users.AnyAsync(u => u.UserId == userId);
            if (!userExists)
            {
                var newUser = _context.CreateDummyUser(userId);
                await _context.Users.AddAsync(newUser);
                await _context.SaveChangesAsync();
            }

            var constructedFriendUserChannel = channelId;
            if (guildId == null)
            {
                var userIds = channelId.Split('_');
                if (userIds.Length != 2 || !userIds.Contains(userId))
                    return BadRequest();

                var recipientId = userIds.First(id => id != userId);
                constructedFriendUserChannel = string.Compare(userId, recipientId) < 0
                    ? $"{userId}_{recipientId}"
                    : $"{recipientId}_{userId}";
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
                    return NotFound();
                }
            }

            if (!string.IsNullOrEmpty(replyToId) && !await _context.Messages.AnyAsync(m => m.MessageId == replyToId))
                return BadRequest();

            return null;
        }

        [NonAction]
        private async Task<List<string>> HandleMessageUrls(string? guildId, string channelId, string userId, string messageId, string content)
        {
            var urls = Utils.ExtractUrls(content);
            var existing = await _context.MessageUrls.FindAsync(messageId);

            if (existing == null)
            {
                try
                {
                    await _context.MessageUrls.AddAsync(new MessageUrl { ChannelId = channelId, CreatedAt = DateTime.UtcNow, GuildId = guildId, UserId = userId, MessageId = messageId, Urls = urls });
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException ex)
                {
                    _logger.LogError(ex.Message);
                }
            }
            else if (existing.Urls != null)
            {
                var newUrls = urls.Except(existing.Urls).ToList();
                if (newUrls.Any())
                {
                    existing.Urls.AddRange(newUrls);
                    _context.MessageUrls.Update(existing);
                    await _context.SaveChangesAsync();
                }
            }
            return urls;
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
            List<Attachment>? attachments,
            string? replyToId,
            string? reactionEmojisIds,
            List<Embed>? embeds)
        {
            var validationResult = await ValidateNewMessage(userId, channelId, guildId, replyToId);
            if (validationResult != null)
                return validationResult;



            var message = new Message
            {
                MessageId = messageId,
                UserId = userId,
                Content = content,
                ChannelId = channelId,
                Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
                LastEdited = lastEdited.HasValue ? DateTime.SpecifyKind(lastEdited.Value, DateTimeKind.Utc) : null,
                ReplyToId = replyToId,
                ReactionEmojisIds = reactionEmojisIds,
                Embeds = embeds ?? new List<Embed>(),
                Metadata = new Metadata(),
                Attachments = attachments
            };

            var links = Utils.ExtractLinks(message.Content);

            if (temporaryId != null && temporaryId.Length == Utils.ID_LENGTH)
                message.TemporaryId = temporaryId;

            await _context.Messages.AddAsync(message);
            await _context.SaveChangesAsync();

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

            if (content != null)
            {
                var urls = await HandleMessageUrls(guildId, channelId, userId, messageId, content);
                await Task.Run(async () =>
                {
                    try
                    {
                        var metadata = await ExtractMetadataIfUrl(urls, messageId);
                        await SaveMetadataAsync(messageId, metadata);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to extract or save metadata for message: " + messageId);
                    }
                });


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
                if (!await _permissionsController.CanSendMessages(userId!, guildId))
                {
                    return StatusCode(StatusCodes.Status403Forbidden);
                }
            }

            if (string.IsNullOrEmpty(channelId))
            {
                return BadRequest(new { Type = "error", Message = "Required property channel id is missing." });
            }

            if (!string.IsNullOrEmpty(request.ReplyToId) && request.ReplyToId.Length != Utils.ID_LENGTH)
            {
                return BadRequest(new { Type = "error", Message = $"Reply id should be {Utils.ID_LENGTH} characters long" });
            }

            long MAX_TOTAL_SIZE = SharedAppConfig.GetMaxAttachmentSize();
            long totalSize = 0;

            var messageId = Utils.CreateRandomId();
            List<Attachment> attachments = new();

            if (request.Files != null && request.Files.Any())
            {
                var files = request.Files.ToList();
                var spoilerFlags = request.IsSpoilerFlags ?? new List<bool>();

                for (int i = 0; i < files.Count; i++)
                {
                    var file = files[i];

                    if (file.Length > MAX_TOTAL_SIZE)
                    {
                        return BadRequest(new { Type = "error", Message = "One of the files exceeds the size limit." });
                    }

                    totalSize += file.Length;
                    if (totalSize > MAX_TOTAL_SIZE)
                    {
                        return BadRequest(new { Type = "error", Message = "Total file size exceeds the size limit." });
                    }

                    string fileId = await _imageController.UploadFileInternal(file, userId, true, false, guildId, channelId);

                    bool isImageFile = FileSignatureValidator.IsImageFile(file);
                    bool isVideoFile = FileSignatureValidator.IsVideoFile(file);
                    bool isSpoiler = spoilerFlags.ElementAtOrDefault(i);

                    attachments.Add(new Attachment
                    {
                        FileId = fileId,
                        IsImageFile = isImageFile,
                        IsVideoFile = isVideoFile,
                        MessageId = messageId,
                        FileName = file.FileName,
                        FileSize = file.Length,
                        IsSpoiler = isSpoiler
                    });
                }
            }


            return await NewMessage(
                messageId,
                request.TemporaryId,
                userId,
                channelId,
                guildId,
                request.Content,
                DateTime.UtcNow,
                null,
                attachments,
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

        private async Task<Metadata> ExtractMetadataIfUrl(List<string> urls, string messageId)
        {
            var fetchedMetadata = await _metadataService.FetchMetadataFromProxyAsync(urls, messageId);
            return fetchedMetadata;
        }

        [NonAction]
        private async Task EditMessage(string userId, string channelId, string messageId, string newContent)
        {
            var message = await _context.Messages.FirstOrDefaultAsync(m =>
                m.MessageId == messageId && m.ChannelId == channelId && m.UserId == userId
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
                _context.Messages.Attach(message);
                _context.Messages.Remove(message);

                var existing = await _context.MessageUrls.FindAsync(messageId);
                if (existing != null && existing.Urls != null && existing.Urls.Any())
                {
                    foreach (var url in existing.Urls)
                    {
                        var isUrlUsedElsewhere = await _context.MessageUrls
                            .Where(mu => mu.MessageId != messageId && mu.Urls != null && mu.Urls.Contains(url))
                            .AnyAsync();

                        if (!isUrlUsedElsewhere)
                        {
                            var mediaUrl = await _context.MediaUrls.FirstOrDefaultAsync(mu => mu.Url == url);
                            if (mediaUrl != null)
                            {
                                _context.MediaUrls.Remove(mediaUrl);
                            }
                        }
                    }

                    _context.MessageUrls.Remove(existing);
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation("Message deleted successfully. ChannelId: {ChannelId}, MessageId: {MessageId}", message.ChannelId, message.MessageId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting message. " + ex.Message);
            }
        }


        [Authorize]
        [HttpGet("/api/guilds/{guildId}/channels/{channelId}/messages/attachments")]
        public async Task<IActionResult> GetAttachments(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50
        )
        {
            bool userExists = await _context.DoesMemberExistInGuild(UserId!, guildId);
            if (!userExists)
            {
                return NotFound();
            }

            pageSize = pageSize > 500 ? 500 : pageSize;
            int skip = (page - 1) * pageSize;

            var query = _context.Attachments
                .Join(
                    _context.Messages,
                    attachment => attachment.MessageId,
                    message => message.MessageId,
                    (attachment, message) => new { attachment, message }
                )
                .Join(
                    _context.Channels,
                    combined => combined.message.ChannelId,
                    channel => channel.ChannelId,
                    (combined, channel) => new
                    {
                        combined.attachment,
                        combined.message.UserId,
                        combined.message.Content,
                        combined.message.Date,
                        channel.ChannelId,
                        channel.GuildId
                    }
                )
                .Where(result => result.ChannelId == channelId && result.GuildId == guildId);

            int totalAttachmentsCountForChannel = await query.CountAsync();

            var channelAttachments = await query
                .Skip(skip)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new { attachments = channelAttachments, count = totalAttachmentsCountForChannel });
        }

        [Authorize]
        [HttpPost("/api/guilds/{guildId}/channels/{channelId}/messages/{messageId}/pin")]
        public async Task<IActionResult> PinMessage(string guildId, string channelId, string messageId)
        {
            var userId = UserId!;

            var member = await _context.GuildMembers
                .Include(m => m.User)
                .Where(m => m.User.UserId == userId && m.GuildId == guildId)
                .FirstOrDefaultAsync();

            if (member == null)
                return NotFound();

            var canManage = await _permissionsController.CanManageMessages(userId, guildId);
            if (!canManage)
                return Forbid();

            var messageExists = await _context.Messages
                .AnyAsync(m => m.MessageId == messageId && m.ChannelId == channelId);

            if (!messageExists)
                return NotFound();

            var alreadyPinned = await _context.Set<ChannelPinnedMessage>()
                .AnyAsync(pm => pm.MessageId == messageId && pm.ChannelId == channelId);

            if (alreadyPinned)
                return Ok();

            _context.Add(new ChannelPinnedMessage
            {
                MessageId = messageId,
                ChannelId = channelId,
                PinnedByUserId = userId,
                PinnedAt = DateTime.UtcNow
            });

            await NewMessage(Utils.CreateRandomId(), Utils.CreateRandomId(), Utils.SystemId, channelId, guildId, " ", DateTime.UtcNow, null, null, null, null, null);

            var pinNotificationMessage = new Message
            {
                MessageId = Utils.CreateRandomId(),
                ChannelId = channelId,
                Date = DateTime.UtcNow,
                IsSystemMessage = true,
                UserId = Utils.SystemId,
                Content = Guid.NewGuid().ToString()
            };
            pinNotificationMessage.IsSystemMessage = true;
            pinNotificationMessage.IsSystemMessage = true;
            pinNotificationMessage.Metadata = new Metadata
            {
                Type = "pin_notification",
                PinnerUserId = member.User.UserId,
                PinnedAt = DateTime.UtcNow
            };
            await _context.Messages.AddAsync(pinNotificationMessage);

            await _context.SaveChangesAsync();
            return Ok();
        }

        [Authorize]
        [HttpPost("/api/guilds/{guildId}/channels/{channelId}/messages/{messageId}/unpin")]
        public async Task<IActionResult> UnpinMessage(string guildId, string channelId, string messageId)
        {
            var userId = UserId!;
            if (!await _context.DoesMemberExistInGuild(userId, guildId))
                return NotFound();

            if (!await _permissionsController.CanManageMessages(userId, guildId))
                return Forbid();

            var pinnedEntry = await _context.Set<ChannelPinnedMessage>()
                .Include(pm => pm.Channel)
                .Where(pm => pm.MessageId == messageId && pm.ChannelId == channelId && pm.Channel.GuildId == guildId)
                .FirstOrDefaultAsync();

            if (pinnedEntry == null)
                return NotFound();

            _context.Remove(pinnedEntry);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return NotFound();
            }

            return Ok(new { messageId });
        }


        [Authorize]
        [HttpGet("/api/guilds/{guildId}/channels/{channelId}/messages/pinned")]
        public async Task<IActionResult> GetPinnedMessages(string guildId, string channelId)
        {
            var userId = UserId!;

            var isValid = await (
                from member in _context.GuildMembers
                join channel in _context.Channels on guildId equals channel.GuildId
                where member.User.UserId == userId
                    && member.GuildId == guildId
                    && channel.ChannelId == channelId
                select member
            ).AnyAsync();

            if (!isValid)
                return NotFound();

            var pinnedMessages = await _context.Set<ChannelPinnedMessage>()
                .Where(pm => pm.ChannelId == channelId)
                .Include(pm => pm.Message)
                .OrderByDescending(pm => pm.PinnedAt)
                .Select(pm => pm.Message)
                .ToListAsync();

            return Ok(new { messages = pinnedMessages, guildId, channelId });
        }
        [Authorize]
        [HttpGet("/api/guilds/{guildId}/channels/{channelId}/messages/links")]
        public async Task<IActionResult> GetGuildMessages(string guildId, string channelId)
        {
            var userId = UserId!;
            if (!await _context.DoesMemberExistInGuild(userId, guildId))
                return NotFound();

            bool channelExists = await _context.Channels
                .AnyAsync(c => c.ChannelId == channelId && c.GuildId == guildId);
            if (!channelExists)
                return NotFound();

            var messages = await _context.Messages
                .Where(m => m.ChannelId == channelId)
                .Include(m => m.Channel)
                .Where(m => m.Channel.GuildId == guildId)
                .ToListAsync();

            var response = new
            {
                channelId,
                messages
            };

            return Ok(response);
        }








    }
}
public class NewBotMessageRequest
{
    [IdLengthValidation]
    public required string MessageId { get; set; }
    public required string UserId { get; set; }
    public string? Content { get; set; }

    private DateTime _date;
    public required DateTime Date
    {
        get => _date;
        set => _date = DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }

    private DateTime? _lastEdited;
    public DateTime? LastEdited
    {
        get => _lastEdited;
        set => _lastEdited = value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;
    }

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

    [BindProperty(Name = "isSpoiler[]")]
    public List<bool>? IsSpoilerFlags { get; set; }

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
