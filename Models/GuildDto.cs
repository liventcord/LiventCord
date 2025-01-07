namespace LiventCord.Models
{
    public class GuildDto
    {
        public required string GuildId { get; set; }
        public required string OwnerId { get; set; }
        public required string GuildName { get; set; }
        public required string RootChannel { get; set; }
        public required string? Region { get; set; }
        public required bool IsGuildUploadedImg { get; set; }
        public required List<string> GuildMembers { get; set; }
        public List<ChannelWithLastRead>? GuildChannels { get; set; }
    }
}
