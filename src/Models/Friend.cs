namespace LiventCord.Models
{
    public enum FriendStatus
    {
        Pending = 0,
        Accepted = 1,
    }

    public class Friend
    {
        public required string UserId { get; set; }
        public required string FriendId { get; set; }
        public FriendStatus Status { get; set; }
    }
}
