using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Concurrent;

namespace LiventCord.Controllers
{
    [ApiController]
    [Authorize]
    public class TypingController : BaseController
    {
        private readonly RedisEventEmitter _redisEventEmitter;
        private readonly int typingTimeoutSeconds = 5;

        private static readonly ConcurrentDictionary<string, List<string>> typingStates = new();
        private static readonly ConcurrentDictionary<string, DateTime> typingTimeouts = new();

        public TypingController(RedisEventEmitter sseManager)
        {
            _redisEventEmitter = sseManager;
        }

        public enum RouteType
        {
            Guild,
            DM
        }

        [Route("/api/guilds/{guildId}/channels/{channelId}/typing/start")]
        [HttpPost]
        public async Task<IActionResult> HandleStartWritingGuild(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string channelId
        )
        {
            return await HandleStartWriting(guildId, channelId, RouteType.Guild);
        }

        [Route("/api/dm/{userId}/typing/start")]
        [HttpPost]
        public async Task<IActionResult> HandleStartWritingDM(
            [FromRoute][UserIdLengthValidation] string userId
        )
        {
            return await HandleStartWriting(userId, "dm", RouteType.DM);
        }

        [Route("/api/guilds/{guildId}/channels/{channelId}/typing/stop")]
        [HttpPost]
        public async Task<IActionResult> HandleStopWritingGuild(
            [FromRoute][IdLengthValidation] string guildId,
            [FromRoute][IdLengthValidation] string channelId
        )
        {
            return await HandleStopWriting(guildId, channelId, RouteType.Guild);
        }

        [Route("/api/dm/{userId}/typing/stop")]
        [HttpPost]
        public async Task<IActionResult> HandleStopWritingDM(
            [FromRoute][UserIdLengthValidation] string userId
        )
        {
            return await HandleStopWriting(userId, "dm", RouteType.DM);
        }

        private async Task<IActionResult> HandleStartWriting(string id, string channelId, RouteType routeType)
        {
            var key = $"{routeType}_{channelId}_{id}";
            if (!typingStates.ContainsKey(key))
            {
                typingStates[key] = new List<string>();
            }

            if (!typingStates[key].Contains(UserId!))
            {
                typingStates[key].Add(UserId!);
            }

            typingTimeouts[UserId!] = DateTime.UtcNow.AddSeconds(typingTimeoutSeconds);

            var messageToEmit = new
            {
                UserId,
                key,
                routeType
            };
            await _redisEventEmitter.EmitToGuild(
                EventType.START_TYPING,
                messageToEmit,
                key,
                UserId!
            );

            _ = CheckTypingTimeoutAsync(key, routeType);

            return Accepted();
        }

        private async Task<IActionResult> HandleStopWriting(string id, string channelId, RouteType routeType)
        {
            var key = $"{routeType}_{channelId}_{id}";

            if (typingStates.ContainsKey(key) && typingStates[key].Contains(UserId!))
            {
                typingStates[key].Remove(UserId!);
            }

            typingTimeouts.TryRemove(UserId!, out _);

            var messageToEmit = new
            {
                UserId,
                key,
                routeType,
                TypingStopped = true,
            };
            await _redisEventEmitter.EmitToGuild(
                EventType.STOP_TYPING,
                messageToEmit,
                key,
                UserId!
            );

            return Accepted();
        }

        private async Task CheckTypingTimeoutAsync(string key, RouteType routeType)
        {
            await Task.Delay(typingTimeoutSeconds * 1000);

            if (typingTimeouts.TryGetValue(UserId!, out var timeoutTime) && timeoutTime <= DateTime.UtcNow)
            {
                HandleTimeoutStopTyping(key, routeType);
            }
        }

        private async void HandleTimeoutStopTyping(string key, RouteType routeType)
        {
            if (typingStates.ContainsKey(key) && typingStates[key].Contains(UserId!))
            {
                typingStates[key].Remove(UserId!);
            }

            var messageToEmit = new
            {
                UserId,
                key,
                routeType,
                TypingStopped = true,
            };
            await _redisEventEmitter.EmitToGuild(
                EventType.STOP_TYPING,
                messageToEmit,
                key,
                UserId!
            );
        }

        [HttpGet]
        [Route("/api/guilds/{guildId}/channels/{channelId}/typing")]
        public IActionResult GetTypingUsersGuild(string guildId, string channelId)
        {
            var key = $"guild_{channelId}_{guildId}";
            if (typingStates.ContainsKey(key))
            {
                return Ok(typingStates[key]);
            }

            return Ok(new List<string>());
        }

        [HttpGet]
        [Route("/api/dm/{userId}/typing")]
        public IActionResult GetTypingUsersDM(string userId)
        {
            var key = $"dm_{userId}";
            if (typingStates.ContainsKey(key))
            {
                return Ok(typingStates[key]);
            }

            return Ok(new List<string>());
        }
    }
}
