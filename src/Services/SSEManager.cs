using System.Security.Claims;
using System.Text.Json;

public class SSEManager
{
    private readonly Dictionary<string, HttpContext> _activeConnections = new();

    public SSEManager() { }

    public async Task EventsStream(HttpContext context, string guildId)
    {
        context.Response.ContentType = "text/event-stream";
        context.Response.Headers["Cache-Control"] = "no-cache"; 
        context.Response.Headers["Connection"] = "keep-alive";  

        string? userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsync("User is not authenticated.");
            return;
        }

        AddConnection(userId, context);
        await Task.Delay(Timeout.Infinite);
    }


    public void AddConnection(string userId, HttpContext context)
    {
        if (!_activeConnections.ContainsKey(userId))
        {
            _activeConnections.Add(userId, context);
        }
        else
        {
            _activeConnections[userId] = context;
        }
    }

    public void RemoveConnection(string userId)
    {
        if (_activeConnections.ContainsKey(userId))
        {
            _activeConnections.Remove(userId);
        }
    }

    public async Task EmitToUser(string userId, string eventType, object message)
    {
        var messageToSend = new { Type = eventType, Data = message };

        if (_activeConnections.ContainsKey(userId))
        {
            var context = _activeConnections[userId];
            await context.Response.WriteAsync(JsonSerializer.Serialize(messageToSend));
            await context.Response.Body.FlushAsync();
        }
    }

    public async Task EmitToGuild(Task<List<string>> guildMembersTask, object messageToEmit)
    {
        List<string> guildMembers = await guildMembersTask;

        foreach (var user in guildMembers)
        {
            await EmitToUser(user, "guild_event", messageToEmit);
        }
    }
}
