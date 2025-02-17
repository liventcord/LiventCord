public class ChannelWithLastRead
{
    public required string ChannelId { get; set; }
    public required string ChannelName { get; set; }
    public bool IsTextChannel { get; set; }
    public DateTime? LastReadDateTime { get; set; }
}
