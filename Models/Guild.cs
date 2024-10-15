﻿using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;

namespace MyPostgresApp.Models
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

        public virtual ICollection<GuildUser> GuildUsers { get; set; } = new List<GuildUser>();
        public virtual ICollection<Channel> Channels { get; set; } = new List<Channel>();

        [NotMapped]
        public IEnumerable<string> UserIds => GuildUsers.Select(gu => gu.UserId);
        public virtual ICollection<GuildPermissions> GuildPermissions { get; set; } = new List<GuildPermissions>();

        public Guild(string ownerId, string rootChannel)    
        {
            OwnerId = ownerId;
            RootChannel = rootChannel;
        }
    }


    public class Channel
    {
        [Key]
        [Column("channel_id")]
        public string ChannelId { get; set; }

        [Column("channel_name")]
        public string ChannelName { get; set; }

        [Column("channel_description")]
        public string? ChannelDescription { get; set; }

        [Column("is_text_channel")]
        public bool IsTextChannel { get; set; } = false;

        [Column("last_read_datetime")]
        public DateTime? LastReadDateTime { get; set; }

        [ForeignKey("Guild")]
        [Column("guild_id")]
        public string GuildId { get; set; }

        [Column("order")]
        public int Order { get; set; }

        public virtual Guild Guild { get; set; } = null!;
        public virtual ICollection<UserChannel> UserChannels { get; set; } 

    }
}
