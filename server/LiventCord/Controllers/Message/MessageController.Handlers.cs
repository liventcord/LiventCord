using System.Text.Json;
using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    public partial class MessageController : BaseController
    {
        // ─── Helpers ────────────────────────────────────────────────────────────

        private static bool TryParseDate(string? date, out DateTime? parsed)
        {
            parsed = null;
            if (date == null) return true;
            if (!DateTime.TryParse(date, out var tmp)) return false;
            parsed = tmp;
            return true;
        }

        // ─── Guild Messages ──────────────────────────────────────────────────────

        [NonAction]
        public async Task<IActionResult> HandleGetGuildMessagesAsync(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromQuery] string? date,
            [FromQuery] string? messageId)
        {
            var userId = UserId!;

            if (!await _context.DoesMemberExistInGuild(userId, guildId))
                return NotFound();

            if (!TryParseDate(date, out var parsedDate))
                return BadRequest("Invalid date format.");

            if (!await _permissionsController.CanReadMessages(userId, guildId))
                return Forbid();

            var messages = await GetMessages(parsedDate, userId, null, channelId, guildId, messageId);

            return Ok(new
            {
                messages,
                channelId,
                guildId,
                oldestMessageDate = messages.Any() ? messages.Min(m => m.Date) : (DateTime?)null,
                isOldMessages = date != null,
            });
        }

        [NonAction]
        public async Task<IActionResult> HandleNewGuildMessageAsync(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromForm] NewMessageRequest request)
        {
            return await HandleMessage(MessageType.Guilds, guildId, channelId, UserId!, null, request);
        }

        [NonAction]
        public async Task<IActionResult> HandleEditGuildMessageAsync(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string channelId,
            [FromRoute][IdLengthValidation] string messageId,
            [FromBody] EditMessageRequest request)
        {
            var userId = UserId!;
            await EditMessage(userId, channelId, messageId, request.Content);
            await IncrementChannelVersion(channelId);

            var broadcast = new { isDm = false, guildId, channelId, messageId, request.Content };
            await _redisEventEmitter.EmitToGuild(EventType.EDIT_MESSAGE_GUILD, broadcast, guildId, userId);
            return Ok(broadcast);
        }

        [NonAction]
        public async Task<IActionResult> HandleDeleteGuildMessageAsync(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [IdLengthValidation][FromRoute] string messageId)
        {
            var userId = UserId!;
            var message = await _context.Messages.FirstOrDefaultAsync(m =>
                m.MessageId == messageId && m.ChannelId == channelId);

            if (message == null)
                return Forbid();

            if (!await _permissionsController.CanDeleteMessages(userId, guildId, message.UserId))
                return Forbid();

            await DeleteMessage(channelId, messageId);
            await IncrementChannelVersion(channelId);

            var broadcast = new { guildId, channelId, messageId };
            await _redisEventEmitter.EmitToGuild(EventType.DELETE_MESSAGE_GUILD, broadcast, guildId, userId);
            return Ok(broadcast);
        }

        // ─── DM Messages ─────────────────────────────────────────────────────────

        [NonAction]
        public async Task<IActionResult> HandleGetDMMessagesAsync(
            [UserIdLengthValidation][FromRoute] string friendId,
            [FromQuery] string? date,
            [FromQuery] string? messageId,
            [FromQuery] string? guildId)
        {
            var userId = UserId!;

            if (!TryParseDate(date, out var parsedDate))
                return BadRequest("Invalid date format.");

            var messages = await GetMessages(parsedDate, userId, friendId, null, guildId, messageId);

            return Ok(new
            {
                messages,
                channelId = ConstructDmId(userId, friendId),
                oldestMessageDate = messages.Any() ? messages.Min(m => m.Date) : (DateTime?)null,
                isOldMessages = date != null,
            });
        }

        [NonAction]
        public async Task<IActionResult> HandleNewDmMessageAsync(
            [UserIdLengthValidation][FromRoute] string friendId,
            [FromForm] NewMessageRequest request)
        {
            var userId = UserId!;

            if (!await CanUsersDm(userId, friendId))
                return Forbid();

            var dmChannelId = ConstructDmId(userId, friendId);

            if (!await _context.Channels.AnyAsync(c => c.ChannelId == dmChannelId))
            {
                await _channelController.CreateChannelInternal(
                    userId, friendId, dmChannelId, dmChannelId,
                    true, false, dmChannelId, false);
            }

            await _friendDmService.AddDmBetweenUsers(userId, friendId);

            return await HandleMessage(MessageType.Dms, null, dmChannelId, userId, friendId, request);
        }

        [NonAction]
        public async Task<IActionResult> HandleEditDMMessageAsync(
            [UserIdLengthValidation][FromRoute] string friendId,
            [IdLengthValidation][FromRoute] string messageId,
            [FromBody] EditMessageRequest request)
        {
            var userId = UserId!;
            var dmChannelId = ConstructDmId(userId, friendId);

            await EditMessage(userId, dmChannelId, messageId, request.Content);
            await IncrementChannelVersion(dmChannelId);

            var broadcast = new { isDm = true, channelId = userId, messageId, content = request.Content };
            await _redisEventEmitter.EmitToFriend(EventType.EDIT_MESSAGE_DM, broadcast, userId, friendId);
            return Ok(broadcast);
        }

        [NonAction]
        public async Task<IActionResult> HandleDeleteDMMessageAsync(
            [UserIdLengthValidation][FromRoute] string channelId,
            [IdLengthValidation][FromRoute] string messageId)
        {
            var userId = UserId!;
            var dmChannelId = ConstructDmId(userId, channelId);

            var message = await _context.Messages.FirstOrDefaultAsync(m => m.MessageId == messageId);
            if (message == null) return NotFound();
            if (message.UserId != userId) return Forbid();

            await DeleteMessage(dmChannelId, messageId);
            await IncrementChannelVersion(dmChannelId);

            var broadcast = new { channelId = userId, userId, messageId, date = message.Date };
            await _redisEventEmitter.EmitToFriend(EventType.DELETE_MESSAGE_DM, broadcast, userId, channelId);
            return Ok(broadcast);
        }

        // ─── Bot Messages ────────────────────────────────────────────────────────

        [NonAction]
        public async Task<IActionResult> HandleNewBotMessageAsync(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromBody] NewBotMessageRequest request)
        {
            if (!ModelState.IsValid) return BadRequest();
            return await ProcessBotMessage(guildId, channelId, request);
        }


        [NonAction]
        public async Task<IActionResult> HandleBulkMessagesAsync(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromBody] List<NewBotMessageRequest> requests)
        {
            if (!ModelState.IsValid) return BadRequest();

            var messageIds = requests.Select(r => r.MessageId).ToList();
            var existingMap = await _context.Messages
                .Include(m => m.Embeds)
                .Where(m => messageIds.Contains(m.MessageId))
                .ToDictionaryAsync(m => m.MessageId);

            foreach (var request in requests)
            {
                if (existingMap.TryGetValue(request.MessageId, out var existing))
                    UpdateMessage(existing, request);
                else
                    _context.Messages.Add(await CreateNewMessage(request, guildId, channelId));
            }

            await _context.SaveChangesAsync();
            return Ok(new { Type = "success", Message = "Messages processed successfully." });
        }

        // ─── Search ──────────────────────────────────────────────────────────────

        [NonAction]
        public async Task<ActionResult<SearchMessagesResponse>> SearchGuildChannelMessagesAsync(
            [FromRoute][IdLengthValidation] string guildId,
            [FromBody] SearchRequest request)
        {
            if (request.PageNumber < 1) request.PageNumber = 1;
            if (request.PageSize < 1) request.PageSize = 50;

            if (!await _context.DoesMemberExistInGuild(UserId!, guildId))
                return Forbid();

            try
            {
                var query = BuildFilteredMessagesQuery(guildId, request.channelId, request.Query, request.FromUserId, request);
                var totalCount = await query.CountAsync();

                var ordered = request.isOldMessages
                    ? query.OrderBy(m => m.Date)
                    : query.OrderByDescending(m => m.Date);

                var messages = await ordered
                    .Skip((request.PageNumber - 1) * request.PageSize)
                    .Take(request.PageSize)
                    .ToListAsync();

                return Ok(new SearchMessagesResponse { TotalCount = totalCount, Messages = messages });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex.Message);
                return StatusCode(500, "An error occurred while searching");
            }
        }

        [NonAction]
        public async Task<ActionResult<IEnumerable<Message>>> SearchDmMessagesAsync(
            [FromRoute][IdLengthValidation] string dmId,
            [FromBody] SearchRequest request)
        {
            if (request.PageNumber < 1) request.PageNumber = 1;
            if (request.PageSize < 1) request.PageSize = 50;

            if (string.IsNullOrWhiteSpace(request.Query))
                return BadRequest("Query cannot be empty.");

            try
            {
                var query = BuildFilteredDmMessagesQuery(dmId, request.Query, UserId!, request.FromUserId, request);
                var totalCount = await query.CountAsync();

                var ordered = request.isOldMessages
                    ? query.OrderBy(m => m.Date)
                    : query.OrderByDescending(m => m.Date);

                var messages = await ordered
                    .Skip((request.PageNumber - 1) * request.PageSize)
                    .Take(request.PageSize)
                    .ToListAsync();

                return Ok(new SearchMessagesResponse
                {
                    TotalCount = totalCount,
                    Messages = messages
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"An error occurred while searching: {ex.Message}");
            }
        }

        // ─── Pinning ─────────────────────────────────────────────────────────────

        [NonAction]
        public async Task<IActionResult> PinMessageAsync(string guildId, string channelId, string messageId)
        {
            var userId = UserId!;

            if (!await _permissionsController.CanManageMessages(userId, guildId))
                return Forbid();

            if (!await _context.Messages.AnyAsync(m => m.MessageId == messageId && m.ChannelId == channelId))
                return NotFound();

            if (await _context.Set<ChannelPinnedMessage>().AnyAsync(pm => pm.MessageId == messageId && pm.ChannelId == channelId))
                return Ok();

            _context.Add(new ChannelPinnedMessage
            {
                MessageId = messageId,
                ChannelId = channelId,
                PinnedByUserId = userId,
                PinnedAt = DateTime.UtcNow,
            });

            var notification = new Message
            {
                MessageId = Utils.CreateRandomId(),
                ChannelId = channelId,
                Date = DateTime.UtcNow,
                IsSystemMessage = true,
                UserId = Utils.SystemId,
                Content = Guid.NewGuid().ToString(),
                Metadata = new Metadata
                {
                    Type = "pin_notification",
                    PinnerUserId = UserId,
                    PinnedAt = DateTime.UtcNow,
                },
            };

            await _context.Messages.AddAsync(notification);
            await _context.SaveChangesAsync();
            await InvalidateMessageCache(guildId, channelId);

            var broadcast = new { guildId, messages = new[] { notification }, channelId, userId };
            await _redisEventEmitter.EmitToGuild(EventType.SEND_MESSAGE_GUILD, broadcast, guildId, userId);

            return Ok(new { pinNotificationMessage = notification });
        }

        [NonAction]
        public async Task<IActionResult> UnpinMessageAsync(string guildId, string channelId, string messageId)
        {
            var userId = UserId!;

            if (!await _context.DoesMemberExistInGuild(userId, guildId)) return NotFound();
            if (!await _permissionsController.CanManageMessages(userId, guildId)) return Forbid();

            var pinned = await _context.Set<ChannelPinnedMessage>()
                .Include(pm => pm.Channel)
                .Where(pm => pm.MessageId == messageId && pm.ChannelId == channelId && pm.Channel.GuildId == guildId)
                .FirstOrDefaultAsync();

            if (pinned == null) return NotFound();

            _context.Remove(pinned);

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
                where member.User.UserId == userId && member.GuildId == guildId && channel.ChannelId == channelId
                select member
            ).AnyAsync();

            if (!isValid) return NotFound();

            var pinned = await _context.Set<ChannelPinnedMessage>()
                .Where(pm => pm.ChannelId == channelId)
                .Include(pm => pm.Message)
                .OrderByDescending(pm => pm.PinnedAt)
                .Select(pm => pm.Message)
                .ToListAsync();

            return Ok(new { messages = pinned, guildId, channelId });
        }

        // ─── Misc ────────────────────────────────────────────────────────────────

        [NonAction]
        public async Task<IActionResult> GetAttachmentsAsync(
            [IdLengthValidation][FromRoute] string guildId,
            [IdLengthValidation][FromRoute] string channelId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (!await _context.DoesMemberExistInGuild(UserId!, guildId))
                return NotFound();

            pageSize = Math.Min(pageSize, 500);
            int skip = (page - 1) * pageSize;

            var baseQuery = _context.Attachments
                .Where(a => a.IsImageFile || (a.IsVideoFile ?? false))
                .Join(_context.Messages, a => a.MessageId, m => m.MessageId, (a, m) => new { a, m })
                .Join(_context.Channels, x => x.m.ChannelId, c => c.ChannelId, (x, c) => new
                {
                    x.a,
                    x.m.UserId,
                    x.m.Content,
                    x.m.Date,
                    c.ChannelId,
                    c.GuildId
                })
                .Where(r => r.ChannelId == channelId && r.GuildId == guildId);

            int totalCount = await baseQuery.CountAsync();

            var attachments = await baseQuery
                .OrderBy(r => r.Date)
                .Skip(skip)
                .Take(pageSize)
                .Select(r => new
                {
                    attachment = r.a,
                    userId = r.UserId,
                    content = r.Content,
                    date = r.Date
                })
                .ToListAsync();

            return Ok(new { attachments, count = totalCount });
        }
        [NonAction]
        public async Task<IActionResult> GetGuildMessagesWithLinksAsync(string guildId, string channelId)
        {
            var userId = UserId!;

            if (!await _context.DoesMemberExistInGuild(userId, guildId))
                return NotFound();

            var messages = await _context.Messages
                .Where(m => m.ChannelId == channelId
                        && m.Channel.GuildId == guildId
                        && _context.MessageUrls.Any(mu =>
                                mu.MessageId == m.MessageId
                            && mu.ChannelId == channelId
                            && mu.Urls != null))
                .ToListAsync();

            return Ok(new { channelId, messages });
        }
        // ─── Private helpers ─────────────────────────────────────────────────────

        [NonAction]
        private async Task<List<Message>> GetMessages(
            DateTime? parsedDate = null,
            string? userId = null,
            string? friendId = null,
            string? channelId = null,
            string? guildId = null,
            string? messageId = null)
        {
            var resolvedChannelId = (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(friendId))
                ? ConstructDmId(userId, friendId)
                : channelId;

            if (string.IsNullOrEmpty(resolvedChannelId))
                return new List<Message>();

            var channel = await _context.Channels
                .AsNoTracking()
                .Select(c => new { c.ChannelId, c.ChannelVersion })
                .FirstOrDefaultAsync(c => c.ChannelId == resolvedChannelId);

            if (channel == null)
                return new List<Message>();

            var dateKeyPart = parsedDate?.ToString("o") ?? string.Empty;
            var cacheKey = $"{guildId}:{resolvedChannelId}:v{channel.ChannelVersion}?date={dateKeyPart}&messageId={messageId}";

            var cached = await _cacheDbContext.CachedMessages.FindAsync(cacheKey);
            if (cached != null)
            {
                try
                {
                    var fromCache = JsonSerializer.Deserialize<List<Message>>(cached.JsonData);
                    if (fromCache != null) return fromCache;
                }
                catch { }
            }

            var query = _context.Messages
                .Include(m => m.Attachments)
                .Where(m => m.ChannelId == resolvedChannelId)
                .AsQueryable();

            if (parsedDate != null)
                query = query.Where(m => m.Date < parsedDate);

            if (!string.IsNullOrEmpty(guildId))
                query = query.Where(m => m.Channel.GuildId == guildId);

            if (!string.IsNullOrEmpty(messageId))
                query = query.Where(m => m.MessageId == messageId);

            var messages = await query
                .OrderByDescending(m => m.Date)
                .Take(50)
                .AsNoTracking()
                .ToListAsync();

            var pinnedIds = (await _context.ChannelPinnedMessages
                .Where(pm => pm.ChannelId == resolvedChannelId)
                .Select(pm => pm.MessageId)
                .ToListAsync()).ToHashSet();

            foreach (var m in messages)
            {
                m.IsPinned = pinnedIds.Contains(m.MessageId);
                if (!m.ShouldSerializeMetadata())
                    m.Metadata = null;
            }

            var serialized = JsonSerializer.Serialize(messages);
            _ = WriteCacheAsync(cacheKey, guildId, resolvedChannelId, serialized, cached);

            return messages;
        }

        private async Task WriteCacheAsync(
            string cacheKey,
            string? guildId,
            string resolvedChannelId,
            string serialized,
            CachedMessage? existing)
        {
            try
            {
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
                        CachedAt = DateTime.UtcNow,
                    });
                }
                await _cacheDbContext.SaveChangesAsync();
            }
            catch { }
        }
        [NonAction]
        private async Task IncrementChannelVersion(string channelId)
        {
            await _context.Channels
                .Where(c => c.ChannelId == channelId)
                .ExecuteUpdateAsync(c => c.SetProperty(ch => ch.ChannelVersion, ch => ch.ChannelVersion + 1));
        }
    }
}