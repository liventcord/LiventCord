namespace LiventCord.Models;

public partial class UserChannel
{
    public string UserId { get; set; } = null!;

    public string ChannelId { get; set; } = null!;

    public DateTime? LastReadDatetime { get; set; }

    public virtual Channel Channel { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
