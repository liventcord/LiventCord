using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LiventCord.Models;

namespace LiventCord.Controllers
{
    [ApiController]
    [Route("/api/")]
    [Authorize]
    public class ChannelReadController : BaseController
    {
        private readonly AppDbContext _db;

        public ChannelReadController(AppDbContext db)
        {
            _db = db;
        }

        [HttpPost("channels/{channelId}/read")]
        public async Task<IActionResult> MarkChannelAsRead([IdLengthValidation] string channelId)
        {
            var userId = UserId!;

            var lastRead = await _db.Messages
                .Where(m => m.ChannelId == channelId)
                .MaxAsync(m => (DateTime?)m.Date);

            if (lastRead == null)
                return Ok(new { channelId, lastRead = (DateTime?)null });

            var userChannel = await _db.UserChannels
                .FirstOrDefaultAsync(uc => uc.ChannelId == channelId && uc.UserId == userId);

            if (userChannel == null)
            {
                _db.UserChannels.Add(new UserChannel
                {
                    ChannelId = channelId,
                    UserId = userId,
                    LastReadDatetime = lastRead.Value
                });
            }
            else
            {
                userChannel.LastReadDatetime = lastRead.Value;
            }

            await _db.SaveChangesAsync();
            return Ok(new { channelId, lastRead });
        }

        
        [HttpPost("guilds/{guildId}/read")]
        public async Task<IActionResult> MarkGuildAsRead([IdLengthValidation] string guildId)
        {
            var userId = UserId!;

            var latestMessages = await _db.Messages
                .Where(m => m.Channel.GuildId == guildId)
                .GroupBy(m => m.ChannelId)
                .Select(g => new
                {
                    ChannelId = g.Key,
                    LastMessageDate = g.Max(m => m.Date)
                })
                .ToListAsync();

            if (latestMessages.Count == 0)
                return Ok(new { guildId });

            var channelIds = latestMessages.Select(x => x.ChannelId).ToList();

            var existingReads = await _db.UserChannels
                .Where(uc => uc.UserId == userId && channelIds.Contains(uc.ChannelId))
                .ToDictionaryAsync(uc => uc.ChannelId);

            foreach (var item in latestMessages)
            {
                if (!existingReads.TryGetValue(item.ChannelId, out var userChannel))
                {
                    _db.UserChannels.Add(new UserChannel
                    {
                        ChannelId = item.ChannelId,
                        UserId = userId,
                        LastReadDatetime = item.LastMessageDate
                    });
                }
                else
                {
                    userChannel.LastReadDatetime = item.LastMessageDate;
                }
            }

            await _db.SaveChangesAsync();
            return Ok(new { guildId });
        }


        [HttpGet("channels/{channelId}/unread-count")]
        public async Task<IActionResult> GetUnreadCount([IdLengthValidation] string channelId)
        {
            var userId = UserId!;

            var lastRead = await _db.UserChannels
                .Where(uc => uc.ChannelId == channelId && uc.UserId == userId)
                .Select(uc => uc.LastReadDatetime)
                .FirstOrDefaultAsync();

            var query = _db.Messages
                .Where(m => m.ChannelId == channelId && m.UserId != userId);

            if (lastRead != null)
                query = query.Where(m => m.Date > lastRead);

            var count = await query.CountAsync();
            return Ok(count);
        }

        [HttpGet("channels/{channelId}/read-state")]
        public async Task<IActionResult> GetReadState([IdLengthValidation] string channelId)
        {
            var lastRead = await _db.UserChannels
                .Where(uc => uc.ChannelId == channelId && uc.UserId == UserId!)
                .Select(uc => uc.LastReadDatetime)
                .FirstOrDefaultAsync();

            return Ok(new { channelId, lastRead });
        }

        [HttpGet("guilds/{guildId}/unread-counts")]
        public async Task<IActionResult> GetGuildUnreadCounts([IdLengthValidation] string guildId)
        {
            var userId = UserId!;

            var unreadCounts = await _db.Messages
                .Where(m => m.Channel.GuildId == guildId && m.UserId != userId)
                .GroupJoin(
                    _db.UserChannels.Where(uc => uc.UserId == userId),
                    m => m.ChannelId,
                    uc => uc.ChannelId,
                    (m, reads) => new { m, read = reads.FirstOrDefault() }
                )
                .Where(x =>
                    x.read == null ||
                    x.read.LastReadDatetime == null ||
                    x.m.Date > x.read.LastReadDatetime
                )
                .GroupBy(x => x.m.ChannelId)
                .Select(g => new
                {
                    ChannelId = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();

            return Ok(unreadCounts);
        }


    }
}
