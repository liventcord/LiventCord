using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LiventCord.Models
{
    [Table("guilds")]
    public class Guild
    {
        [Key]
        [Column("guild_id")]
        public string GuildId { get; set; }

        [Column("owner_id")]
        public string OwnerId { get; set; }

        [Column("guild_name")]
        public string GuildName { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("root_channel")]
        public string RootChannel { get; set; }

        [Column("region")]
        public string? Region { get; set; }

        [Column("settings")]
        public string? Settings { get; set; }

        [Column("is_guild_uploaded_img")]
        public bool IsGuildUploadedImg { get; set; }

        [Column("is_public")]
        public bool IsPublic { get; set; }

        public virtual ICollection<GuildMember> GuildMembers { get; set; } =
            new List<GuildMember>();
        public virtual ICollection<Channel> Channels { get; set; } = new List<Channel>();

        [NotMapped]
        public IEnumerable<string> UserIds => GuildMembers.Select(gu => gu.MemberId);

        public virtual ICollection<GuildPermissions> GuildPermissions { get; set; } =
            new List<GuildPermissions>();

        public Guild(
            string guildId,
            string ownerId,
            string guildName,
            string rootChannel,
            string? region = null,
            bool isGuildUploadedImg = false,
            bool isPublic = false
        )
        {
            GuildId = guildId;
            OwnerId = ownerId;
            GuildName = guildName;
            RootChannel = rootChannel;
            Region = region;
            IsGuildUploadedImg = isGuildUploadedImg;
            IsPublic = isPublic;
        }
    }

    public class Channel
    {
        [Key]
        [Column("channel_id")]
        public required string ChannelId { get; set; }

        [Column("channel_name")]
        public required string ChannelName { get; set; }

        [Column("channel_description")]
        public string? ChannelDescription { get; set; }

        [Column("is_text_channel")]
        public required bool IsTextChannel { get; set; } = false;
        [Column("is_private")]
        public required bool IsPrivate { get; set; } = false;

        [Column("last_read_datetime")]
        public DateTime? LastReadDateTime { get; set; }

        [ForeignKey("Guild")]
        [Column("guild_id")]
        public required string GuildId { get; set; }

        [Column("order")]
        public int Order { get; set; }

        public virtual Guild Guild { get; set; } = null!;
        public virtual ICollection<UserChannel>? UserChannels { get; set; }
    }
}
