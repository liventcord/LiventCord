using System.Text.Json;
using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    public partial class MessageController : BaseController
    {
        [NonAction]
        public async Task<IActionResult> HandleGetGuildMessagesAsync(
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

            var messages = await GetMessages(
                parsedDate?.ToString("o"),
                userId,
                null,
                channelId,
                guildId,
                messageId
            );
            var oldestMessageDate = messages.Any() ? messages.Min(m => m.Date) : (DateTime?)null;
            bool isOldMessages = date != null;
            return Ok(
                new
                {
                    messages,
                    channelId,
                    guildId,
                    oldestMessageDate,
                    isOldMessages,
                }
            );
        }
        [NonAction]
        public async Task<IActionResult> HandleGetDMMessagesAsync(
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

            var messages = await GetMessages(
                parsedDate?.ToString("o"),
                UserId!,
                friendId,
                null,
                guildId,
                messageId
            );
            var oldestMessageDate = messages.Any() ? messages.Min(m => m.Date) : (DateTime?)null;
            bool isOldMessages = date != null;
            return Ok(
                new
                {
                    messages,
                    channelId = constructedFriendUserChannel,
                    oldestMessageDate,
                    isOldMessages,
                }
            );
        }

        [NonAction]
        public async Task<IActionResult> HandleNewDmMessageAsync(
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

            var channelExists = await _context.Channels.AnyAsync(c =>
                c.ChannelId == constructedFriendUserChannel
            );
            if (!channelExists)
            {
                await _channelController.CreateChannelInternal(
                    userId,
                    friendId,
                    constructedFriendUserChannel,
                    constructedFriendUserChannel,
                    true,
                    false,
                    constructedFriendUserChannel,
                    false
                );
            }

            await _friendDmService.AddDmBetweenUsers(userId, friendId);

            return await HandleMessage(
                MessageType.Dms,
                null,
                constructedFriendUserChannel,
                UserId!,
                friendId,
                request
            );
        }
        [NonAction]
        public async Task<IActionResult> HandleNewBotMessageAsync(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromBody] NewBotMessageRequest request
        )
        {
            if (!ModelState.IsValid)
                return BadRequest();

            return await ProcessBotMessage(guildId, channelId, request);
        }
        [NonAction]
        public async Task<IActionResult> HandleBulkMessagesAsync(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromBody] List<NewBotMessageRequest> requests
        )
        {
            if (!ModelState.IsValid)
                return BadRequest();

            foreach (var request in requests)
            {
                var message = await _context
                    .Messages.Include(m => m.Embeds)
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


        [NonAction]
        public async Task<IActionResult> HandleEditGuildMessageAsync(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string channelId,
            [FromRoute][IdLengthValidation] string messageId,
            [FromBody] EditMessageRequest request
        )
        {
            var userId = UserId!;
            await EditMessage(userId, channelId, messageId, request.Content);
            await IncrementChannelVersion(channelId);

            bool isDm = false;
            var editBroadcast = new
            {
                isDm,
                guildId,
                channelId,
                messageId,
                request.Content,
            };

            await _redisEventEmitter.EmitToGuild(
                EventType.EDIT_MESSAGE_GUILD,
                editBroadcast,
                guildId,
                userId
            );

            return Ok(editBroadcast);
        }


        [NonAction]
        public async Task<IActionResult> HandleEditDMMessageAsync(
            [UserIdLengthValidation][FromRoute] string friendId,
            [IdLengthValidation][FromRoute] string messageId,
            [FromBody] EditMessageRequest request
        )
        {
            var userId = UserId!;
            var constructedFriendUserChannel = ConstructDmId(userId, friendId);

            await EditMessage(userId, constructedFriendUserChannel, messageId, request.Content);
            await IncrementChannelVersion(constructedFriendUserChannel);

            bool isDm = true;
            var editBroadcast = new
            {
                isDm,
                channelId = userId,
                messageId,
                content = request.Content,
            };

            await _redisEventEmitter.EmitToFriend(
                EventType.EDIT_MESSAGE_DM,
                editBroadcast,
                userId,
                friendId
            );

            return Ok(editBroadcast);
        }

        [NonAction]
        public async Task<IActionResult> HandleDeleteGuildMessageAsync(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [IdLengthValidation][FromRoute] string messageId
        )
        {
            var foundMessage = await _context.Messages.FirstOrDefaultAsync(m =>
                m.MessageId == messageId && m.ChannelId == channelId
            );

            if (foundMessage == null)
                return Forbid();

            if (!await _permissionsController.CanDeleteMessages(
                UserId!,
                guildId,
                foundMessage.UserId))
                return Forbid();

            await DeleteMessage(channelId, messageId);
            await IncrementChannelVersion(channelId);

            var deleteBroadcast = new
            {
                guildId,
                channelId,
                messageId,
            };

            await _redisEventEmitter.EmitToGuild(
                EventType.DELETE_MESSAGE_GUILD,
                deleteBroadcast,
                guildId,
                UserId!
            );

            return Ok(deleteBroadcast);
        }

        [NonAction]
        public async Task<IActionResult> HandleDeleteDMMessageAsync(
            [UserIdLengthValidation][FromRoute] string channelId,
            [IdLengthValidation][FromRoute] string messageId
        )
        {
            var userId = UserId!;
            var constructedFriendUserChannel = ConstructDmId(userId, channelId);

            var foundMessage = await _context.Messages.FirstOrDefaultAsync(m =>
                m.MessageId == messageId
            );
            DateTime date;

            if (foundMessage == null)
                return NotFound();

            if (foundMessage.UserId != userId)
                return Forbid();

            date = foundMessage.Date;

            await DeleteMessage(constructedFriendUserChannel, messageId);
            await IncrementChannelVersion(constructedFriendUserChannel);

            var deleteBroadcast = new { channelId = userId, userId, messageId, date };
            await _redisEventEmitter.EmitToFriend(
                EventType.DELETE_MESSAGE_DM,
                deleteBroadcast,
                userId,
                channelId
            );


            return Ok(deleteBroadcast);
        }


        [NonAction]
        public async Task<ActionResult<SearchMessagesResponse>> SearchGuildChannelMessagesAsync(
            [FromRoute][IdLengthValidation] string guildId,
            [FromBody] SearchRequest request
        )
        {
            if (request.PageNumber < 1)
                request.PageNumber = 1;
            if (request.PageSize < 1)
                request.PageSize = 50;

            var isReversing = request.isOldMessages;

            if (!await _context.DoesMemberExistInGuild(UserId!, guildId))
                return Forbid();

            try
            {
                var filteredQuery = BuildFilteredMessagesQuery(
                    guildId,
                    request.channelId,
                    request.Query,
                    request.FromUserId,
                    request
                );

                var totalCount = await filteredQuery.CountAsync();

                var orderedQuery = isReversing
                    ? filteredQuery.OrderBy(m => m.Date)
                    : filteredQuery.OrderByDescending(m => m.Date);

                var messages = await orderedQuery
                    .Skip((request.PageNumber - 1) * request.PageSize)
                    .Take(request.PageSize)
                    .ToListAsync();

                return Ok(
                    new SearchMessagesResponse { TotalCount = totalCount, Messages = messages }
                );
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred while searching: {ex.Message}");
            }
        }
        [NonAction]
        public async Task<ActionResult<IEnumerable<Message>>> SearchDmMessagesAsync(
            [FromRoute][IdLengthValidation] string dmId,
            [FromQuery] string? fromUserId,
            [FromBody] string query
        )
        {
            if (string.IsNullOrWhiteSpace(query))
                return BadRequest("Query cannot be empty.");

            try
            {
                var results = await SearchDmMessagesInContext(dmId, query, UserId!, fromUserId);
                if (results == null || !results.Any())
                    return NotFound("No messages found matching your query.");

                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred while searching: {ex.Message}");
            }
        }

        [NonAction]
        private async Task<List<Message>> GetMessages(
            string? date = null,
            string? userId = null,
            string? friendId = null,
            string? channelId = null,
            string? guildId = null,
            string? messageId = null
        )
        {
            DateTime? parsedDate = null;
            if (date != null && DateTime.TryParse(date, out DateTime tempParsedDate))
            {
                parsedDate = tempParsedDate.ToUniversalTime();
            }

            string? resolvedChannelId = channelId;

            if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(friendId))
            {
                resolvedChannelId = ConstructDmId(userId, friendId);
            }

            if (string.IsNullOrEmpty(resolvedChannelId))
            {
                return new List<Message>();
            }

            var channel = await _context.Channels
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.ChannelId == resolvedChannelId);

            if (channel == null)
            {
                return new List<Message>();
            }

            var cacheKey = $"{guildId}:{resolvedChannelId}:v{channel.ChannelVersion}?date={date}&messageId={messageId}";

            var cached = await _cacheDbContext.CachedMessages.FindAsync(cacheKey);
            if (cached != null)
            {
                try
                {
                    var cachedMessages = JsonSerializer.Deserialize<List<Message>>(cached.JsonData);
                    if (cachedMessages != null)
                        return cachedMessages;
                }
                catch
                {
                }
            }

            var query = _context
                .Messages.Include(m => m.Attachments)
                .Include(m => m.Channel)
                .AsQueryable();

            if (parsedDate != null)
                query = query.Where(m => m.Date < parsedDate);

            query = query.Where(m => m.ChannelId == resolvedChannelId);

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

            var messagesList = result.Select(r => r.Message).ToList();

            try
            {
                var serialized = JsonSerializer.Serialize(messagesList);

                var existing = await _cacheDbContext.CachedMessages.FindAsync(cacheKey);
                if (existing != null)
                {
                    existing.JsonData = serialized;
                    existing.CachedAt = DateTime.UtcNow;
                }
                else
                {
                    _cacheDbContext.CachedMessages.Add(new CachedMessage
                    {
                        CacheKey = cacheKey,
                        GuildId = guildId ?? string.Empty,
                        ChannelId = resolvedChannelId,
                        JsonData = serialized,
                        CachedAt = DateTime.UtcNow
                    });
                }

                await _cacheDbContext.SaveChangesAsync();
            }
            catch
            {
            }

            return messagesList;
        }
        [NonAction]
        private async Task IncrementChannelVersion(string channelId)
        {
            var channel = await _context.Channels
                .FirstOrDefaultAsync(c => c.ChannelId == channelId);

            if (channel != null)
            {
                channel.ChannelVersion++;
                await _context.SaveChangesAsync();
            }
        }


        [NonAction]
        public async Task<IActionResult> GetAttachmentsAsync(
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

            pageSize = Math.Min(pageSize, 500);
            int skip = (page - 1) * pageSize;

            var query = _context
                .Attachments.Where(a => a.IsImageFile || (a.IsVideoFile ?? false))
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
                    (combined, channel) =>
                        new
                        {
                            combined.attachment,
                            combined.message.UserId,
                            combined.message.Content,
                            combined.message.Date,
                            channel.ChannelId,
                            channel.GuildId,
                        }
                )
                .Where(result => result.ChannelId == channelId && result.GuildId == guildId);

            int totalAttachmentsCountForChannel = await query.CountAsync();

            var channelAttachments = await query.Skip(skip).Take(pageSize).ToListAsync();

            return Ok(
                new { attachments = channelAttachments, count = totalAttachmentsCountForChannel }
            );
        }
        [NonAction]
        public async Task<IActionResult> PinMessageAsync(
            string guildId,
            string channelId,
            string messageId
        )
        {
            var userId = UserId!;

            var member = await _context
                .GuildMembers.Include(m => m.User)
                .Where(m => m.User.UserId == userId && m.GuildId == guildId)
                .FirstOrDefaultAsync();

            if (member == null)
                return NotFound();

            var canManage = await _permissionsController.CanManageMessages(userId, guildId);
            if (!canManage)
                return Forbid();

            var messageExists = await _context.Messages.AnyAsync(m =>
                m.MessageId == messageId && m.ChannelId == channelId
            );

            if (!messageExists)
                return NotFound();

            var alreadyPinned = await _context
                .Set<ChannelPinnedMessage>()
                .AnyAsync(pm => pm.MessageId == messageId && pm.ChannelId == channelId);

            if (alreadyPinned)
                return Ok();

            _context.Add(
                new ChannelPinnedMessage
                {
                    MessageId = messageId,
                    ChannelId = channelId,
                    PinnedByUserId = userId,
                    PinnedAt = DateTime.UtcNow,
                }
            );

            var pinNotificationMessage = new Message
            {
                MessageId = Utils.CreateRandomId(),
                ChannelId = channelId,
                Date = DateTime.UtcNow,
                IsSystemMessage = true,
                UserId = Utils.SystemId,
                Content = Guid.NewGuid().ToString(),
            };
            pinNotificationMessage.IsSystemMessage = true;
            pinNotificationMessage.Metadata = new Metadata
            {
                Type = "pin_notification",
                PinnerUserId = member.User.UserId,
                PinnedAt = DateTime.UtcNow,
            };
            await _context.Messages.AddAsync(pinNotificationMessage);
            await _context.SaveChangesAsync();
            await InvalidateMessageCache(guildId, channelId);

            var broadcastMessage = new
            {
                guildId,
                messages = new[] { pinNotificationMessage },
                channelId,
                userId,
            };
            await _redisEventEmitter.EmitToGuild(
                EventType.SEND_MESSAGE_GUILD,
                broadcastMessage,
                guildId,
                userId
            );

            return Ok(new { pinNotificationMessage });
        }
        [NonAction]
        public async Task<IActionResult> HandleNewGuildMessageAsync(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromForm] NewMessageRequest request
        )
        {
            return await HandleMessage(MessageType.Guilds, guildId, channelId, UserId!, null, request);
        }
        [NonAction]
        public async Task<IActionResult> UnpinMessageAsync(
            string guildId,
            string channelId,
            string messageId
        )
        {
            var userId = UserId!;
            if (!await _context.DoesMemberExistInGuild(userId, guildId))
                return NotFound();

            if (!await _permissionsController.CanManageMessages(userId, guildId))
                return Forbid();

            var pinnedEntry = await _context
                .Set<ChannelPinnedMessage>()
                .Include(pm => pm.Channel)
                .Where(pm =>
                    pm.MessageId == messageId
                    && pm.ChannelId == channelId
                    && pm.Channel.GuildId == guildId
                )
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
        [NonAction]
        public async Task<IActionResult> GetPinnedMessagesAsync(string guildId, string channelId)
        {
            var userId = UserId!;

            var isValid = await (
                from member in _context.GuildMembers
                join channel in _context.Channels on guildId equals channel.GuildId
                where
                    member.User.UserId == userId
                    && member.GuildId == guildId
                    && channel.ChannelId == channelId
                select member
            ).AnyAsync();

            if (!isValid)
                return NotFound();

            var pinnedMessages = await _context
                .Set<ChannelPinnedMessage>()
                .Where(pm => pm.ChannelId == channelId)
                .Include(pm => pm.Message)
                .OrderByDescending(pm => pm.PinnedAt)
                .Select(pm => pm.Message)
                .ToListAsync();

            return Ok(
                new
                {
                    messages = pinnedMessages,
                    guildId,
                    channelId,
                }
            );
        }
        [NonAction]
        public async Task<IActionResult> GetGuildMessagesWithLinksAsync(string guildId, string channelId)
        {
            var userId = UserId!;
            if (!await _context.DoesMemberExistInGuild(userId, guildId))
                return NotFound();

            bool channelExists = await _context.Channels.AnyAsync(c =>
                c.ChannelId == channelId && c.GuildId == guildId
            );
            if (!channelExists)
                return NotFound();

            var messagesWithLinks = await _context
                .Messages.Where(m => m.ChannelId == channelId && m.Channel.GuildId == guildId)
                .Where(m => _context.MessageUrls.Any(mu => mu.MessageId == m.MessageId))
                .ToListAsync();

            var response = new { channelId, messages = messagesWithLinks };

            return Ok(response);
        }


    }
}

