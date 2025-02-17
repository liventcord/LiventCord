using Microsoft.AspNetCore.SignalR;

public class NotificationHub : Hub
{
    public async Task SendGuildMessage(string message)
    {
        await Clients.All.SendAsync("GUILD_MESSAGE", message);
    }

    public async Task SendDirectMessage(string connectionId, string message)
    {
        await Clients.Client(connectionId).SendAsync("DM_MESSAGE", message);
    }

    public async Task SendMessageToGroup(string groupName, string message)
    {
        await Clients.Group(groupName).SendAsync("GROUP_MESSAGE", message);
    }

    public async Task AddToGroup(string groupName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
    }

    public async Task RemoveFromGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }

    public async Task UpdateUserStatus(string userId, bool isOnline)
    {
        await Clients.All.SendAsync("USER_STATUS", new { userId, isOnline });
    }

    public async Task UpdateUserProfile(string userId)
    {
        await Clients.All.SendAsync("UPDATE_USER", new { userId });
    }
}
