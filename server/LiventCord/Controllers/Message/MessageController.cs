using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LiventCord.Controllers
{
    [ApiController]
    [Route("")]
    public partial class MessageController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly PermissionsController _permissionsController;
        private readonly MetadataController _metadataService;
        private readonly FileController _fileController;
        private readonly RedisEventEmitter _redisEventEmitter;
        private readonly ChannelController _channelController;
        private readonly FriendDmService _friendDmService;
        private readonly IAppLogger<MessageController> _logger;
        private readonly CacheDbContext _cacheDbContext;
        private readonly IServiceScopeFactory _scopeFactory;

        public MessageController(
            AppDbContext context,
            PermissionsController permissionsController,
            MetadataController metadataService,
            FileController fileController,
            RedisEventEmitter redisEventEmitter,
            IAppLogger<MessageController> logger,
            ChannelController channelController,
            FriendDmService friendDmService,
            CacheDbContext cacheDbContext,
            IServiceScopeFactory scopeFactory
        )
        {
            _permissionsController = permissionsController;
            _context = context;
            _metadataService = metadataService;
            _fileController = fileController;
            _redisEventEmitter = redisEventEmitter;
            _logger = logger;
            _channelController = channelController;
            _friendDmService = friendDmService;
            _cacheDbContext = cacheDbContext;
            _scopeFactory = scopeFactory;
        }

        [Authorize]
        [HttpGet("/api/guilds/{guildId}/channels/{channelId}/messages")]
        public Task<IActionResult> HandleGetGuildMessages(string guildId, string channelId, string? date, string? messageId) =>
            HandleGetGuildMessagesAsync(guildId, channelId, date, messageId);

        [Authorize]
        [HttpGet("/api/dms/channels/{friendId}/messages")]
        public Task<IActionResult> HandleGetDMMessages(string friendId, string? date, string? messageId, string? guildId) =>
            HandleGetDMMessagesAsync(friendId, date, messageId, guildId);

        [Authorize]
        [HttpPost("/api/guilds/{guildId}/channels/{channelId}/messages")]
        public Task<IActionResult> HandleNewGuildMessage(string guildId, string channelId, NewMessageRequest request) =>
            HandleNewGuildMessageAsync(guildId, channelId, request);

        [Authorize]
        [HttpPost("/api/dms/channels/{friendId}/messages")]
        public Task<IActionResult> HandleNewDmMessage(string friendId, NewMessageRequest request) =>
            HandleNewDmMessageAsync(friendId, request);

        [HttpPost("/api/discord/bot/messages/{guildId}/{channelId}")]
        [ValidateBotToken]
        public Task<IActionResult> HandleNewBotMessage(string guildId, string channelId, NewBotMessageRequest request) =>
            HandleNewBotMessageAsync(guildId, channelId, request);

        [HttpPost("/api/discord/bot/messages/bulk/{guildId}/{channelId}")]
        [ValidateBotToken]
        public Task<IActionResult> HandleBulkMessages(string guildId, string channelId, List<NewBotMessageRequest> requests) =>
            HandleBulkMessagesAsync(guildId, channelId, requests);

        [Authorize]
        [HttpPatch("/api/guilds/{guildId}/channels/{channelId}/messages/{messageId}")]
        public Task<IActionResult> HandleEditGuildMessage(string guildId, string channelId, string messageId, EditMessageRequest request) =>
            HandleEditGuildMessageAsync(guildId, channelId, messageId, request);

        [Authorize]
        [HttpPatch("/api/dms/channels/{friendId}/messages/{messageId}")]
        public Task<IActionResult> HandleEditDMMessage(string friendId, string messageId, EditMessageRequest request) =>
            HandleEditDMMessageAsync(friendId, messageId, request);

        [Authorize]
        [HttpDelete("/api/guilds/{guildId}/channels/{channelId}/messages/{messageId}")]
        public Task<IActionResult> HandleDeleteGuildMessage(string guildId, string channelId, string messageId) =>
            HandleDeleteGuildMessageAsync(guildId, channelId, messageId);

        [Authorize]
        [HttpDelete("/api/dms/channels/{channelId}/messages/{messageId}")]
        public Task<IActionResult> HandleDeleteDMMessage(string channelId, string messageId) =>
            HandleDeleteDMMessageAsync(channelId, messageId);

        [Authorize]
        [HttpGet("/api/guilds/{guildId}/channels/{channelId}/messages/attachments")]
        public Task<IActionResult> GetAttachments(string guildId, string channelId, int page = 1, int pageSize = 50) =>
            GetAttachmentsAsync(guildId, channelId, page, pageSize);

        [Authorize]
        [HttpPost("/api/guilds/{guildId}/channels/{channelId}/messages/{messageId}/pin")]
        public Task<IActionResult> PinMessage(string guildId, string channelId, string messageId) =>
            PinMessageAsync(guildId, channelId, messageId);

        [Authorize]
        [HttpPost("/api/guilds/{guildId}/channels/{channelId}/messages/{messageId}/unpin")]
        public Task<IActionResult> UnpinMessage(string guildId, string channelId, string messageId) =>
            UnpinMessageAsync(guildId, channelId, messageId);

        [Authorize]
        [HttpGet("/api/guilds/{guildId}/channels/{channelId}/messages/pinned")]
        public Task<IActionResult> GetPinnedMessages(string guildId, string channelId) =>
            GetPinnedMessagesAsync(guildId, channelId);

        [Authorize]
        [HttpGet("/api/guilds/{guildId}/channels/{channelId}/messages/links")]
        public Task<IActionResult> GetGuildMessagesWithLinks(string guildId, string channelId) =>
            GetGuildMessagesWithLinksAsync(guildId, channelId);

        [Authorize]
        [HttpPost("/api/guilds/{guildId}/messages/search")]
        public Task<ActionResult<SearchMessagesResponse>> SearchGuildChannelMessages(string guildId, SearchRequest request) =>
            SearchGuildChannelMessagesAsync(guildId, request);

        [Authorize]
        [HttpGet("/api/dms/{dmId}/messages/search")]
        public Task<ActionResult<IEnumerable<Message>>> SearchDmMessages(string dmId, string? fromUserId, string query) =>
            SearchDmMessagesAsync(dmId, fromUserId, query);


    }
}

