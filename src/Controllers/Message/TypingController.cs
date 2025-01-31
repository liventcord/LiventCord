using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("/api/guilds/{guildId}/channels/{channelId}/typing")]
    [ApiController]
    [Authorize]
    public class TypingController : BaseController
    {
        private readonly AppDbContext _dbContext;
        private readonly SSEManager _sseManager;
        private readonly MembersController _membersController;

        private Dictionary<string, List<string>> writingMembersState = new();

        private Dictionary<string, DateTime> typingTimeouts = new();

        private readonly int typingTimeoutSeconds = 5;

        public TypingController(
            AppDbContext dbContext,
            SSEManager sseManager,
            MembersController membersController
        )
        {
            _dbContext = dbContext;
            _sseManager = sseManager;
            _membersController = membersController;
        }

        [HttpPost("start")]
        public async Task<IActionResult> HandleStartWriting(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string channelId
        )
        {
            if (!writingMembersState.ContainsKey(guildId))
            {
                writingMembersState[guildId] = new List<string>();
            }

            if (!writingMembersState[guildId].Contains(UserId!))
            {
                writingMembersState[guildId].Add(UserId!);
            }

            typingTimeouts[UserId!] = DateTime.UtcNow.AddSeconds(typingTimeoutSeconds);

            var messageToEmit = new
            {
                UserId,
                guildId,
                channelId,
            };
            await _sseManager.EmitToGuild(
                _membersController.GetGuildMembersIds(guildId),
                messageToEmit
            );

            _ = CheckTypingTimeoutAsync(guildId, channelId);

            return Accepted();
        }

        [HttpPost("stop")]
        public async Task<IActionResult> HandleStopWriting(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string channelId
        )
        {
            if (writingMembersState.TryGetValue(guildId, out var users) && users.Contains(UserId!))
            {
                users.Remove(UserId!);
            }

            typingTimeouts.Remove(UserId!);

            var messageToEmit = new
            {
                UserId,
                guildId,
                channelId,
                TypingStopped = true,
            };
            await _sseManager.EmitToGuild(
                _membersController.GetGuildMembersIds(guildId),
                messageToEmit
            );

            return Accepted();
        }

        [HttpGet]
        public async Task<List<string>?> GetTypingUsers(string guildId, string channelId)
        {
            var typingUsers = await _dbContext
                .TypingStatuses.Where(t => t.GuildId == guildId && t.ChannelId == channelId)
                .Select(t => t.UserId)
                .ToListAsync();

            return typingUsers;
        }

        private async Task CheckTypingTimeoutAsync(string guildId, string channelId)
        {
            await Task.Delay(typingTimeoutSeconds * 1000);
            if (
                typingTimeouts.TryGetValue(UserId!, out var timeoutTime)
                && timeoutTime <= DateTime.UtcNow
            )
            {
                HandleTimeoutStopTyping(guildId, channelId);
            }
        }

        private async void HandleTimeoutStopTyping(string guildId, string channelId)
        {
            if (writingMembersState.TryGetValue(guildId, out var users) && users.Contains(UserId!))
            {
                users.Remove(UserId!);
            }

            var messageToEmit = new
            {
                UserId,
                guildId,
                channelId,
                TypingStopped = true,
            };
            await _sseManager.EmitToGuild(
                _membersController.GetGuildMembersIds(guildId),
                messageToEmit
            );
        }
    }
}
