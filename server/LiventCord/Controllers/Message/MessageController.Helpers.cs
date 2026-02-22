using System.Text.Json;
using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    public partial class MessageController
    {
        // ──────────────────────────────────────────────
        // Attachment helpers
        // ──────────────────────────────────────────────

        private Attachment BuildAttachment(string fileId, string fileName, long fileSize,
            bool isImage, bool isVideo, bool isSpoiler, string messageId) =>
            new()
            {
                FileId = fileId,
                FileName = fileName,
                FileSize = fileSize,
                IsImageFile = isImage,
                IsVideoFile = isVideo,
                IsSpoiler = isSpoiler,
                MessageId = messageId,
            };

        private List<Attachment> CreateAttachmentsFromUrls(string urls, string messageId) =>
            urls.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(url => BuildAttachment(Utils.CreateRandomId(), url, 0, true, true, false, messageId))
                .ToList();

        // ──────────────────────────────────────────────
        // Embed helpers
        // ──────────────────────────────────────────────

        private static List<Embed> NormaliseEmbeds(IEnumerable<Embed>? embeds)
        {
            if (embeds == null) return new List<Embed>();
            foreach (var e in embeds)
                e.Id ??= Utils.CreateRandomId();
            return embeds.ToList();
        }

        // ──────────────────────────────────────────────
        // Message construction / mutation
        // ──────────────────────────────────────────────

        private void UpdateMessage(Message message, NewBotMessageRequest request)
        {
            message.Content = request.Content;
            message.LastEdited = DateTime.UtcNow;
            message.ReplyToId = request.ReplyToId;
            message.ReactionEmojisIds = request.ReactionEmojisIds;

            if (request.AttachmentUrls != null)
                message.Attachments = CreateAttachmentsFromUrls(request.AttachmentUrls, message.MessageId);

            if (request.Embeds?.Any() == true)
            {
                message.Embeds.Clear();
                message.Embeds.AddRange(NormaliseEmbeds(request.Embeds));
            }
        }

        private Task<Message> CreateNewMessage(NewBotMessageRequest request, string guildId, string channelId)
        {
            if (request.Content != null)
                _ = RunMetadataInBackground(guildId, channelId, request.UserId, request.MessageId, request.Content);
            return Task.FromResult(new Message
            {
                MessageId = request.MessageId,
                Content = request.Content,
                UserId = request.UserId,
                Date = request.Date,
                ChannelId = channelId,
                LastEdited = request.LastEdited,
                ReplyToId = request.ReplyToId,
                ReactionEmojisIds = request.ReactionEmojisIds,
                Attachments = request.AttachmentUrls != null
                    ? CreateAttachmentsFromUrls(request.AttachmentUrls, request.MessageId)
                    : null,
                Embeds = NormaliseEmbeds(request.Embeds),
            });
        }

        // ──────────────────────────────────────────────
        // DM channel ID
        // ──────────────────────────────────────────────

        private static string ConstructDmId(string userId, string friendId) =>
            string.Compare(userId, friendId, StringComparison.Ordinal) < 0
                ? $"{userId}_{friendId}"
                : $"{friendId}_{userId}";

        // ──────────────────────────────────────────────
        // Search queries
        // ──────────────────────────────────────────────

        private IQueryable<Message> BuildFilteredMessagesQuery(
            string guildId, string? channelId, string? query, string? fromUserId, SearchRequest request)
        {
            var q = _context.Messages
                .Where(m => m.Content != null && m.Channel.GuildId == guildId)
                .Where(m => channelId == null || m.ChannelId == channelId);

            if (!string.IsNullOrEmpty(fromUserId))
                q = q.Where(m => m.UserId == fromUserId);

            if (!string.IsNullOrWhiteSpace(query))
                q = Utils.IsPostgres(_context)
                    ? q.Where(m => EF.Functions.ILike(m.Content!, $"%{query}%"))
                    : q.Where(m => m.Content!.Contains(query));

            if (DateTime.TryParse(request.BeforeDate, out var before))
                q = q.Where(m => m.Date < DateTime.SpecifyKind(before, DateTimeKind.Utc));

            if (DateTime.TryParse(request.DuringDate, out var during))
            {
                var d = DateTime.SpecifyKind(during, DateTimeKind.Utc);
                q = q.Where(m => m.Date >= d && m.Date < d.AddDays(1));
            }

            if (DateTime.TryParse(request.AfterDate, out var after))
                q = q.Where(m => m.Date > DateTime.SpecifyKind(after, DateTimeKind.Utc));

            return q;
        }

        private async Task<List<Message>?> SearchDmMessagesInContext(
            string dmId, string query, string currentUserId, string? fromUserId)
        {
            if (!await CanUsersDm(currentUserId, dmId))
                return null;

            var channelId = ConstructDmId(currentUserId, dmId);

            var q = _context.Messages.Where(m => m.Content != null && m.ChannelId == channelId);

            q = Utils.IsPostgres(_context)
                ? q.Where(m => EF.Functions.ToTsVector("english", m.Content!).Matches(query))
                : q.Where(m => m.Content!.Contains(query));

            if (!string.IsNullOrEmpty(fromUserId))
                q = q.Where(m => m.UserId == fromUserId);

            return await q.ToListAsync();
        }

        // ──────────────────────────────────────────────
        // Cache invalidation
        // ──────────────────────────────────────────────

        private async Task InvalidateMessageCache(string? guildId = null, string? channelId = null)
        {
            var q = _cacheDbContext.CachedMessages.AsQueryable();
            if (!string.IsNullOrEmpty(guildId)) q = q.Where(c => c.GuildId == guildId);
            if (!string.IsNullOrEmpty(channelId)) q = q.Where(c => c.ChannelId == channelId);

            var entries = await q.ToListAsync();
            if (entries.Any())
            {
                _cacheDbContext.CachedMessages.RemoveRange(entries);
                await _cacheDbContext.SaveChangesAsync();
            }
        }

        // ──────────────────────────────────────────────
        // Validation
        // ──────────────────────────────────────────────

        [NonAction]
        private async Task<IActionResult?> ValidateNewMessage(
            string userId, string channelId, string? guildId, string? replyToId)
        {
            if (!await _context.Users.AnyAsync(u => u.UserId == userId))
            {
                await _context.Users.AddAsync(_context.CreateDummyUser(userId));
                await _context.SaveChangesAsync();
            }

            var resolvedChannelId = channelId;

            if (guildId == null)
            {
                var parts = channelId.Split('_');
                if (parts.Length != 2 || !parts.Contains(userId))
                    return BadRequest();

                var recipientId = parts.First(id => id != userId);
                resolvedChannelId = ConstructDmId(userId, recipientId);
            }

            if (!await _context.Channels.AnyAsync(c => c.ChannelId == resolvedChannelId))
            {
                if (guildId == null)
                    await _channelController.CreateChannelInternal(
                        userId, null, resolvedChannelId, resolvedChannelId, true, false, resolvedChannelId, false);
                else
                    return NotFound();
            }

            if (!string.IsNullOrEmpty(replyToId) && !await _context.Messages.AnyAsync(m => m.MessageId == replyToId))
                return BadRequest();

            return null;
        }

        // ──────────────────────────────────────────────
        // URL handling & metadata
        // ──────────────────────────────────────────────

        [NonAction]
        private async Task<List<string>> HandleMessageUrls(
            string? guildId, string channelId, string userId, string messageId, string content)
        {
            var urls = Utils.ExtractUrls(content);
            var existing = await _context.MessageUrls.FindAsync(messageId);

            if (existing == null)
            {
                try
                {
                    await _context.MessageUrls.AddAsync(new MessageUrl
                    {
                        ChannelId = channelId,
                        CreatedAt = DateTime.UtcNow,
                        GuildId = guildId,
                        UserId = userId,
                        MessageId = messageId,
                        Urls = urls,
                    });
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException ex) { _logger.LogError(ex.Message); }
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

        private Task RunMetadataInBackground(
            string? guildId,
            string channelId,
            string userId,
            string messageId,
            string content)
        {
            return Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();

                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var mediaProxyController = scope.ServiceProvider.GetRequiredService<MediaProxyController>();
                    var logger = scope.ServiceProvider.GetRequiredService<ILogger<MetadataController>>();

                    var urls = Utils.ExtractUrls(content);

                    var existing = await db.MessageUrls.FindAsync(messageId);

                    if (existing == null)
                    {
                        await db.MessageUrls.AddAsync(new MessageUrl
                        {
                            ChannelId = channelId,
                            CreatedAt = DateTime.UtcNow,
                            GuildId = guildId,
                            UserId = userId,
                            MessageId = messageId,
                            Urls = urls,
                        });

                        await db.SaveChangesAsync();
                    }
                    else if (existing.Urls != null)
                    {
                        var newUrls = urls.Except(existing.Urls).ToList();
                        if (newUrls.Any())
                        {
                            existing.Urls.AddRange(newUrls);
                            db.MessageUrls.Update(existing);
                            await db.SaveChangesAsync();
                        }
                    }

                    if (!urls.Any()) return;

                    var request = new HttpRequestMessage(
                        HttpMethod.Post,
                        SharedAppConfig.MediaWorkerUrl + "/api/proxy/metadata"
                    )
                    {
                        Content = JsonContent.Create(urls),
                    };
                    request.Headers.Add("Authorization", SharedAppConfig.AdminKey);

                    var httpClient = scope.ServiceProvider.GetRequiredService<HttpClient>();
                    var response = await httpClient.SendAsync(request, CancellationToken.None);
                    var rawResponse = await response.Content.ReadAsStringAsync();

                    if (!response.IsSuccessStatusCode)
                    {
                        logger.LogError(
                            "Request to proxy server failed: {StatusCode} {Response}",
                            response.StatusCode, rawResponse);
                        return;
                    }

                    var metadataList = JsonSerializer.Deserialize<List<MetadataWithMedia>>(rawResponse);
                    if (metadataList == null) return;

                    foreach (var metadataWithUrls in metadataList)
                    {
                        var mediaUrl = metadataWithUrls.mediaUrl;
                        if (mediaUrl != null)
                        {
                            await mediaProxyController.AddMediaUrl(mediaUrl, messageId);
                        }
                    }

                    var message = await db.Messages.FirstOrDefaultAsync(m => m.MessageId == messageId);
                    if (message != null)
                    {
                        message.Metadata = metadataList.Select(m => m.metadata).FirstOrDefault() ?? new Metadata();
                        await db.SaveChangesAsync();
                    }
                }
                catch (Exception ex)
                {
                    var logger = _scopeFactory.CreateScope()
                        .ServiceProvider
                        .GetRequiredService<ILogger<MetadataController>>();

                    logger.LogError(ex,
                        "Background metadata processing failed for message {MessageId}",
                        Utils.SanitizeLogInput(messageId));
                }
            });
        }
        private async Task<Metadata> ExtractMetadataIfUrl(List<string> urls, string messageId) =>
            await _metadataService.FetchMetadataFromProxyAsync(urls, messageId);

        private async Task SaveMetadataAsync(string messageId, Metadata metadata)
        {
            var message = await _context.Messages.FirstOrDefaultAsync(m => m.MessageId == messageId);
            if (message != null)
            {
                message.Metadata = metadata;
                await _context.SaveChangesAsync();
            }
        }

        // ──────────────────────────────────────────────
        // Emit events
        // ──────────────────────────────────────────────

        [NonAction]
        private async Task EmitNewMessage(Message message, string? guildId, string channelId, string userId, string? friendId)
        {
            if (guildId != null)
            {
                _logger.LogInformation("Emitting message to guild. GuildId: {GuildId}, ChannelId: {ChannelId}", guildId, channelId);
                await _redisEventEmitter.EmitToGuild(
                    EventType.SEND_MESSAGE_GUILD,
                    new { guildId, messages = new[] { message }, channelId, userId },
                    guildId, userId);
            }
            else if (friendId != null)
            {
                _logger.LogInformation("Emitting DM message. ChannelId: {ChannelId}, UserId: {UserId}", channelId, userId);
                await _redisEventEmitter.EmitToFriend(
                    EventType.SEND_MESSAGE_DM,
                    new { message, channelId = userId },
                    userId, friendId);
            }
        }

        // ──────────────────────────────────────────────
        // Core NewMessage / HandleMessage pipeline
        // ──────────────────────────────────────────────

        [NonAction]
        private async Task<IActionResult> NewMessage(
            string messageId, string? temporaryId, string userId, string? friendId,
            string channelId, string? guildId, string? content, DateTime date, DateTime? lastEdited,
            List<Attachment>? attachments, string? replyToId, string? reactionEmojisIds,
            List<Embed>? embeds, bool? IsSystemMessage = false)
        {
            var validationResult = await ValidateNewMessage(userId, channelId, guildId, replyToId);
            if (validationResult != null) return validationResult;

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
                Attachments = attachments,
                IsSystemMessage = IsSystemMessage,
            };

            if (temporaryId?.Length == Utils.ID_LENGTH)
                message.TemporaryId = temporaryId;

            await _context.Messages.AddAsync(message);
            await _context.SaveChangesAsync();

            await InvalidateMessageCache(guildId, channelId);
            await EmitNewMessage(message, guildId, channelId, userId, friendId);

            if (content != null)
                _ = RunMetadataInBackground(guildId, channelId, userId, messageId, content);

            return Ok(new { message, guildId });
        }

        [NonAction]
        private async Task<IActionResult> HandleMessage(
            MessageType mode, string? guildId, string channelId,
            string userId, string? friendId, NewMessageRequest request)
        {
            if (mode == MessageType.Guilds)
            {
                if (string.IsNullOrWhiteSpace(guildId))
                    return BadRequest(new { Type = "error", Message = "Missing guildId" });

                if (!await _permissionsController.CanSendMessages(userId!, guildId))
                    return StatusCode(StatusCodes.Status403Forbidden);
            }

            if (string.IsNullOrEmpty(channelId))
                return BadRequest(new { Type = "error", Message = "Required property channel id is missing." });

            if (!string.IsNullOrEmpty(request.ReplyToId) && request.ReplyToId.Length != Utils.ID_LENGTH)
                return BadRequest(new { Type = "error", Message = $"Reply id should be {Utils.ID_LENGTH} characters long" });

            long maxSize = SharedAppConfig.GetMaxAttachmentSize();
            long totalSize = 0;
            var messageId = Utils.CreateRandomId();
            var attachments = new List<Attachment>();

            foreach (var (file, index) in (request.Files ?? Enumerable.Empty<IFormFile>()).Select((f, i) => (f, i)))
            {
                if (file.Length > maxSize)
                    return BadRequest(new { Type = "error", Message = "One of the files exceeds the size limit." });

                totalSize += file.Length;
                if (totalSize > maxSize)
                    return BadRequest(new { Type = "error", Message = "Total file size exceeds the size limit." });

                var fileId = await _fileController.UploadFileInternalAsync(file, userId, true, false, guildId, channelId);
                var isSpoiler = request.IsSpoilerFlags?.ElementAtOrDefault(index) ?? false;

                attachments.Add(BuildAttachment(
                    fileId, file.FileName, file.Length,
                    FileSignatureValidator.IsImageFile(file),
                    FileSignatureValidator.IsVideoFile(file),
                    isSpoiler, messageId));
            }

            return await NewMessage(messageId, request.TemporaryId, userId, friendId,
                channelId, guildId, request.Content, DateTime.UtcNow, null,
                attachments, request.ReplyToId, null, null);
        }

        // ──────────────────────────────────────────────
        // Edit / Delete / Query helpers
        // ──────────────────────────────────────────────

        [NonAction]
        private async Task<bool> MessageExists(string messageId, string channelId) =>
            await _context.Messages.AnyAsync(m => m.MessageId == messageId && m.ChannelId == channelId);

        [NonAction]
        private async Task EditMessage(string userId, string channelId, string messageId, string newContent)
        {
            var message = await _context.Messages.FirstOrDefaultAsync(m =>
                m.MessageId == messageId && m.ChannelId == channelId && m.UserId == userId);

            if (message == null) return;

            message.Content = newContent;
            message.LastEdited = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        private async Task DeleteMessagesFromUser(string userId)
        {
            var messages = await _context.Messages.Where(m => m.UserId == userId).ToListAsync();
            foreach (var message in messages)
                await DeleteMessage(message.ChannelId, message.MessageId);
        }

        private async Task<Message?> GetMessageWithRelations(string messageId, string channelId)
        {
            var message = await _context.Messages
                .Include(m => m.Attachments)
                .Include(m => m.Embeds)
                .FirstOrDefaultAsync(m => m.MessageId == messageId && m.ChannelId == channelId);

            if (message == null)
                _logger.LogWarning("Message not found. MessageId: {MessageId}, ChannelId: {ChannelId}", messageId, channelId);

            return message;
        }

        private async Task DeleteMessage(string channelId, string messageId)
        {
            var message = await GetMessageWithRelations(messageId, channelId);
            if (message == null) return;

            try
            {
                _fileController.DeleteAttachmentFileAsync(message);

                var pinned = await _context.ChannelPinnedMessages
                    .Where(p => p.MessageId == messageId).ToListAsync();
                if (pinned.Any())
                    _context.ChannelPinnedMessages.RemoveRange(pinned);

                _context.Messages.Remove(message);

                var existingUrls = await _context.MessageUrls.FindAsync(messageId);
                if (existingUrls?.Urls?.Any() == true)
                {
                    foreach (var url in existingUrls.Urls)
                    {
                        var usedElsewhere = await _context.MessageUrls
                            .AnyAsync(mu => mu.MessageId != messageId && mu.Urls != null && mu.Urls.Contains(url));

                        if (!usedElsewhere)
                        {
                            var mediaUrl = await _context.MediaUrls.FirstOrDefaultAsync(mu => mu.Url == url);
                            if (mediaUrl != null) _context.MediaUrls.Remove(mediaUrl);
                        }
                    }
                    _context.MessageUrls.Remove(existingUrls);
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation("Message deleted. ChannelId: {ChannelId}, MessageId: {MessageId}", channelId, messageId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting message. MessageId: {MessageId}, ChannelId: {ChannelId}", messageId, channelId);
            }
        }

        // ──────────────────────────────────────────────
        // Bot message processing
        // ──────────────────────────────────────────────

        private async Task<IActionResult> ProcessBotMessage(string guildId, string channelId, NewBotMessageRequest request)
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

            request.Embeds = NormaliseEmbeds(request.Embeds);

            var newMessage = await CreateNewMessage(request, guildId, channelId);
            _context.Messages.Add(newMessage);
            await _context.SaveChangesAsync();
            return Ok(new { Type = "success", Message = "Message inserted to guild." });
        }

        // ──────────────────────────────────────────────
        // DM permission check
        // ──────────────────────────────────────────────

        private async Task<bool> CanUsersDm(string userId, string friendId) =>
            await _context.CheckFriendship(userId, friendId) ||
            await _context.AreUsersSharingGuild(userId, friendId);
    }
}