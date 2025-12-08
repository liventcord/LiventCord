using System.ComponentModel.DataAnnotations;

public class MessageUrl
{
    [Key]
    public required string MessageId { get; set; }

    public List<string>? Urls { get; set; }

    public required string ChannelId { get; set; }

    public string? GuildId { get; set; }

    public required string UserId { get; set; }

    public required DateTime CreatedAt { get; set; }
}
