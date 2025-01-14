namespace LiventCord.Models;

public partial class TypingStatus
{
    public string UserId { get; set; } = null!;

    public string GuildId { get; set; } = null!;

    public string ChannelId { get; set; } = null!;

    public DateTime Timestamp { get; set; }
}
