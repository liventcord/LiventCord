using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    public partial class MessageController
    {
        private List<Attachment> CreateAttachmentsFromUrls(string urls, string messageId)
        {
            List<Attachment> attachments = new();
            List<string> parsedUrls = urls.Split(
                    ',',
                    StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
                )
                .ToList();

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
                    IsSpoiler = isSpoiler,
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
                message.Attachments = CreateAttachmentsFromUrls(
                    request.AttachmentUrls,
                    message.MessageId
                );
            }
            message.ReplyToId = request.ReplyToId;
            message.ReactionEmojisIds = request.ReactionEmojisIds;

            if (request.Embeds != null && request.Embeds.Any())
            {
                message.Embeds.Clear();
                var newEmbeds = request
                    .Embeds.Select(embed =>
                    {
                        embed.Id ??= Utils.CreateRandomId();
                        return embed;
                    })
                    .ToList();

                message.Embeds.AddRange(newEmbeds);
            }
        }

        private async Task<Message> CreateNewMessage(
            NewBotMessageRequest request,
            string guildId,
            string channelId
        )
        {
            if (request.Content != null)
            {
                await Task.Run(async () =>
                {
                    var urls = await HandleMessageUrls(
                        guildId,
                        channelId,
                        request.UserId,
                        request.MessageId,
                        request.Content
                    );
                    try
                    {
                        var metadata = await ExtractMetadataIfUrl(urls, request.MessageId);
                        await SaveMetadataAsync(request.MessageId, metadata);
                    }
                    catch (Exception ex)
                    {
                        var sanitizedMessageId = Utils.SanitizeLogInput(request.MessageId);
                        _logger.LogError(
                            ex,
                            "Failed to extract or save metadata for message: {MessageId}",
                            sanitizedMessageId
                        );
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
                Attachments =
                    request.AttachmentUrls != null
                        ? CreateAttachmentsFromUrls(request.AttachmentUrls, request.MessageId)
                        : null,
                ReplyToId = request.ReplyToId,
                ReactionEmojisIds = request.ReactionEmojisIds,
                Embeds =
                    request
                        .Embeds?.Select(embed =>
                        {
                            embed.Id ??= Utils.CreateRandomId();
                            return embed;
                        })
                        .ToList() ?? new List<Embed>(),
            };
        }


        private string ConstructDmId(string userId, string friendId)
        {
            return string.Compare(userId, friendId) < 0
                ? $"{userId}_{friendId}"
                : $"{friendId}_{userId}";
        }


        private IQueryable<Message> BuildFilteredMessagesQuery(
                    string guildId,
                    string? channelId,
                    string? query,
                    string? fromUserId,
                    SearchRequest request
                )
        {
            IQueryable<Message> queryable = _context.Messages.Where(m => m.Content != null);
            queryable = queryable.Where(m =>
                m.Channel.GuildId == guildId && (channelId == null || m.ChannelId == channelId)
            );

            if (!string.IsNullOrEmpty(fromUserId))
                queryable = queryable.Where(m => m.UserId == fromUserId);

            if (!string.IsNullOrWhiteSpace(query))
            {
                if (Utils.IsPostgres(_context))
                    queryable = queryable.Where(m =>
                        m.Content != null && EF.Functions.ILike(m.Content, $"%{query}%")
                    );
                else
                    queryable = queryable.Where(m =>
                        m.Content != null && m.Content.Contains(query)
                    );
            }

            if (DateTime.TryParse(request.BeforeDate, out var beforeDate))
            {
                beforeDate = DateTime.SpecifyKind(beforeDate, DateTimeKind.Utc);
                queryable = queryable.Where(m => m.Date < beforeDate);
            }

            if (DateTime.TryParse(request.DuringDate, out var duringDate))
            {
                duringDate = DateTime.SpecifyKind(duringDate, DateTimeKind.Utc);
                queryable = queryable.Where(m =>
                    m.Date >= duringDate && m.Date < duringDate.AddDays(1)
                );
            }

            if (DateTime.TryParse(request.AfterDate, out var afterDate))
            {
                afterDate = DateTime.SpecifyKind(afterDate, DateTimeKind.Utc);
                queryable = queryable.Where(m => m.Date > afterDate);
            }

            return queryable;
        }

        private async Task<List<Message>?> SearchDmMessagesInContext(
                    string dmId,
                    string query,
                    string currentUserId,
                    string? fromUserId
                )
        {
            if (!await CanUsersDm(currentUserId, dmId))
                return null;

            var channelId = ConstructDmId(currentUserId, dmId);

            IQueryable<Message> queryable = _context.Messages.Where(m => m.Content != null);

            queryable = Utils.IsPostgres(_context)
                ? queryable.Where(m =>
                    m.Content != null
                    && EF.Functions.ToTsVector("english", m.Content).Matches(query)
                )
                : queryable.Where(m => m.Content != null && m.Content.Contains(query));

            queryable = queryable.Where(m => m.ChannelId == channelId);

            if (!string.IsNullOrEmpty(fromUserId))
                queryable = queryable.Where(m => m.UserId == fromUserId);

            return await queryable.ToListAsync();
        }
        private async Task InvalidateMessageCache(
            string? guildId = null,
            string? channelId = null
        )
        {
            var query = _cacheDbContext.CachedMessages.AsQueryable();

            if (!string.IsNullOrEmpty(guildId))
                query = query.Where(c => c.GuildId == guildId);

            if (!string.IsNullOrEmpty(channelId))
                query = query.Where(c => c.ChannelId == channelId);

            var cachedEntries = await query.ToListAsync();
            if (cachedEntries.Any())
            {
                _cacheDbContext.CachedMessages.RemoveRange(cachedEntries);
                await _cacheDbContext.SaveChangesAsync();
            }
        }
        [NonAction]
        private async Task<IActionResult?> ValidateNewMessage(
            string userId,
            string channelId,
            string? guildId,
            string? replyToId
        )
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
                constructedFriendUserChannel =
                    string.Compare(userId, recipientId) < 0
                        ? $"{userId}_{recipientId}"
                        : $"{recipientId}_{userId}";
            }

            var channelExists = await _context.Channels.AnyAsync(c =>
                c.ChannelId == constructedFriendUserChannel
            );
            if (!channelExists)
            {
                if (guildId == null)
                {
                    await _channelController.CreateChannelInternal(
                        userId,
                        null,
                        constructedFriendUserChannel,
                        constructedFriendUserChannel,
                        true,
                        false,
                        constructedFriendUserChannel,
                        false
                    );
                }
                else
                {
                    return NotFound();
                }
            }

            if (
                !string.IsNullOrEmpty(replyToId)
                && !await _context.Messages.AnyAsync(m => m.MessageId == replyToId)
            )
                return BadRequest();

            return null;
        }

        [NonAction]
        private async Task<List<string>> HandleMessageUrls(
            string? guildId,
            string channelId,
            string userId,
            string messageId,
            string content
        )
        {
            var urls = Utils.ExtractUrls(content);
            var existing = await _context.MessageUrls.FindAsync(messageId);

            if (existing == null)
            {
                try
                {
                    await _context.MessageUrls.AddAsync(
                        new MessageUrl
                        {
                            ChannelId = channelId,
                            CreatedAt = DateTime.UtcNow,
                            GuildId = guildId,
                            UserId = userId,
                            MessageId = messageId,
                            Urls = urls,
                        }
                    );
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
        private async Task EmitNewMessage(Message message, string? guildId, string channelId, string userId, string? friendId)
        {
            if (guildId != null)
            {
                _logger.LogInformation("Emitting message to guild. GuildId: {GuildId}, ChannelId: {ChannelId}", guildId, channelId);
                var broadcastMessage = new
                {
                    guildId,
                    messages = new[] { message },
                    channelId,
                    userId,
                };
                await _redisEventEmitter.EmitToGuild(
                    EventType.SEND_MESSAGE_GUILD,
                    broadcastMessage,
                    guildId,
                    userId
                );
            }
            else if (friendId != null)
            {
                _logger.LogInformation("Emitting DM message. ChannelId: {ChannelId}, UserId: {UserId}", channelId, userId);
                var dmMessage = new
                {
                    message,
                    channelId = userId
                };
                await _redisEventEmitter.EmitToFriend(
                    EventType.SEND_MESSAGE_DM,
                    dmMessage,
                    userId,
                    friendId
                );
            }
        }

        [NonAction]
        private async Task<IActionResult> NewMessage(
             string messageId,
             string? temporaryId,
             string userId,
             string? friendId,
             string channelId,
             string? guildId,
             string? content,
             DateTime date,
             DateTime? lastEdited,
             List<Attachment>? attachments,
             string? replyToId,
             string? reactionEmojisIds,
             List<Embed>? embeds,
             bool? IsSystemMessage = false
         )
        {
            var validationResult = await ValidateNewMessage(userId, channelId, guildId, replyToId);
            if (validationResult != null)
            {
                return validationResult;
            }

            var message = new Message
            {
                MessageId = messageId,
                UserId = userId,
                Content = content,
                ChannelId = channelId,
                Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
                LastEdited = lastEdited.HasValue
                    ? DateTime.SpecifyKind(lastEdited.Value, DateTimeKind.Utc)
                    : null,
                ReplyToId = replyToId,
                ReactionEmojisIds = reactionEmojisIds,
                Embeds = embeds ?? new List<Embed>(),
                Metadata = new Metadata(),
                Attachments = attachments,
                IsSystemMessage = IsSystemMessage,
            };

            if (temporaryId != null && temporaryId.Length == Utils.ID_LENGTH)
            {
                message.TemporaryId = temporaryId;

            }

            await _context.Messages.AddAsync(message);
            await _context.SaveChangesAsync();


            await InvalidateMessageCache(guildId, channelId);

            await EmitNewMessage(message, guildId, channelId, userId, friendId);

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
                        _logger.LogError(
                            ex,
                            "Failed to extract or save metadata for message: {MessageId}",
                            messageId
                        );
                    }
                });
            }

            return Ok(new { message, guildId });
        }

        private async Task SaveMetadataAsync(string messageId, Metadata metadata)
        {
            var message = await _context.Messages.FirstOrDefaultAsync(m =>
                m.MessageId == messageId
            );
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
            string? friendId,
            NewMessageRequest request
        )
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
                return BadRequest(
                    new { Type = "error", Message = "Required property channel id is missing." }
                );
            }

            if (
                !string.IsNullOrEmpty(request.ReplyToId)
                && request.ReplyToId.Length != Utils.ID_LENGTH
            )
            {
                return BadRequest(
                    new
                    {
                        Type = "error",
                        Message = $"Reply id should be {Utils.ID_LENGTH} characters long",
                    }
                );
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
                        return BadRequest(
                            new
                            {
                                Type = "error",
                                Message = "One of the files exceeds the size limit.",
                            }
                        );
                    }

                    totalSize += file.Length;
                    if (totalSize > MAX_TOTAL_SIZE)
                    {
                        return BadRequest(
                            new
                            {
                                Type = "error",
                                Message = "Total file size exceeds the size limit.",
                            }
                        );
                    }

                    string fileId = await _imageController.UploadFileInternalAsync(
                        file,
                        userId,
                        true,
                        false,
                        guildId,
                        channelId
                    );

                    bool isImageFile = FileSignatureValidator.IsImageFile(file);
                    bool isVideoFile = FileSignatureValidator.IsVideoFile(file);
                    bool isSpoiler = spoilerFlags.ElementAtOrDefault(i);

                    attachments.Add(
                        new Attachment
                        {
                            FileId = fileId,
                            IsImageFile = isImageFile,
                            IsVideoFile = isVideoFile,
                            MessageId = messageId,
                            FileName = file.FileName,
                            FileSize = file.Length,
                            IsSpoiler = isSpoiler,
                        }
                    );
                }
            }

            return await NewMessage(
                messageId,
                request.TemporaryId,
                userId,
                friendId,
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
            var fetchedMetadata = await _metadataService.FetchMetadataFromProxyAsync(
                urls,
                messageId
            );
            return fetchedMetadata;
        }

        [NonAction]
        private async Task EditMessage(
            string userId,
            string channelId,
            string messageId,
            string newContent
        )
        {
            var message = await _context.Messages.FirstOrDefaultAsync(m =>
                m.MessageId == messageId && m.ChannelId == channelId && m.UserId == userId
            );

            if (message == null) return;

            message.Content = newContent;
            message.LastEdited = DateTime.UtcNow;
            await _context.SaveChangesAsync();

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

        private async Task<Message?> GetMessageWithRelations(string messageId, string channelId)
        {
            var message = await _context.Messages
                .Include(m => m.Attachments)
                .Include(m => m.Embeds)
                .FirstOrDefaultAsync(m => m.MessageId == messageId && m.ChannelId == channelId);

            if (message == null)
            {
                _logger.LogWarning("Message not found. MessageId: {MessageId}, ChannelId: {ChannelId}", messageId, channelId);
            }
            else
            {
                if (message.Attachments == null || !message.Attachments.Any())
                {
                    _logger.LogDebug("Message.Attachments is null or empty. MessageId: {MessageId}, ChannelId: {ChannelId}", messageId, channelId);
                }
            }

            return message;
        }

        private async Task DeleteMessage(string channelId, string messageId)
        {
            var message = await GetMessageWithRelations(messageId, channelId);
            if (message == null)
                return;

            try
            {
                await _imageController.DeleteAttachmentFileAsync(message);

                var pinnedEntries = await _context
                    .ChannelPinnedMessages.Where(p => p.MessageId == messageId)
                    .ToListAsync();
                if (pinnedEntries.Any())
                {
                    _context.ChannelPinnedMessages.RemoveRange(pinnedEntries);
                }

                _context.Messages.Remove(message);

                var existingUrls = await _context.MessageUrls.FindAsync(messageId);
                if (existingUrls != null && existingUrls.Urls != null && existingUrls.Urls.Any())
                {
                    foreach (var url in existingUrls.Urls)
                    {
                        var isUrlUsedElsewhere = await _context.MessageUrls
                            .Where(mu => mu.MessageId != messageId && mu.Urls != null && mu.Urls.Contains(url))
                            .AnyAsync();

                        if (!isUrlUsedElsewhere)
                        {
                            var mediaUrl = await _context.MediaUrls.FirstOrDefaultAsync(mu => mu.Url == url);
                            if (mediaUrl != null)
                                _context.MediaUrls.Remove(mediaUrl);
                        }
                    }

                    _context.MessageUrls.Remove(existingUrls);
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation("Message deleted successfully. ChannelId: {ChannelId}, MessageId: {MessageId}", message.ChannelId, message.MessageId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting message. MessageId: {MessageId}, ChannelId: {ChannelId}", message.MessageId, message.ChannelId);
            }
        }
        private async Task<IActionResult> ProcessBotMessage(
            string guildId,
            string channelId,
            NewBotMessageRequest request
        )
        {
            var message = await _context
                .Messages.Include(m => m.Embeds)
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

    }
}