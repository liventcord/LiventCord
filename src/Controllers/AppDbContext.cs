using System.Text.Json;
using System.Text.Json.Serialization;
using LiventCord.Models;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Discriminator> Discriminators { get; set; }
        public DbSet<Friend> Friends { get; set; }
        public DbSet<UserDm> UserDms { get; set; }
        public DbSet<TypingStatus> TypingStatuses { get; set; }
        public DbSet<Guild> Guilds { get; set; }
        public DbSet<Channel> Channels { get; set; }
        public DbSet<GuildMember> GuildMembers { get; set; }
        public DbSet<GuildPermissions> GuildPermissions { get; set; }
        public DbSet<AttachmentFile> AttachmentFiles { get; set; }
        public DbSet<EmojiFile> EmojiFiles { get; set; }
        public DbSet<ProfileFile> ProfileFiles { get; set; }
        public DbSet<GuildFile> GuildFiles { get; set; }
        public DbSet<UserChannel> UserChannels { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<GuildInvite> GuildInvites { get; set; }
        public DbSet<UrlMetadata> UrlMetadata { get; set; }

        public void RecreateDatabase()
        {
            Database.EnsureDeleted();
            Database.EnsureCreated();
        }

        public async Task<bool> DoesGuildExist(string guildId)
        {
            if (string.IsNullOrEmpty(guildId))
                return false;

            return await Guilds.AnyAsync(g => g.GuildId == guildId);
        }

        public async Task<bool> DoesMemberExistInGuild(string userId, string guildId)
        {
            return await GuildMembers.AnyAsync(gu =>
                gu.MemberId == userId && gu.GuildId == guildId
            );
        }

        public async Task<bool> IsGuildPublic(string guildId)
        {
            if (string.IsNullOrEmpty(guildId))
                return false;

            return await Guilds.AnyAsync(g => g.GuildId == guildId && g.IsPublic);
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("users");
                entity.HasKey(u => u.UserId);
                entity.Property(u => u.UserId).HasColumnName("user_id").IsRequired();
                entity.Property(u => u.Email).HasColumnName("email").IsRequired().HasMaxLength(128);
                entity
                    .Property(u => u.Password)
                    .HasColumnName("password")
                    .IsRequired()
                    .HasMaxLength(128);
                entity.Property(u => u.Nickname).HasColumnName("nickname").HasMaxLength(128);

                entity.HasIndex(u => u.Email).IsUnique();
            });

            modelBuilder.Entity<Discriminator>().ToTable("discriminators");
            modelBuilder.Entity<Discriminator>().HasKey(d => d.Id);
            modelBuilder
                .Entity<Discriminator>()
                .Property(d => d.Nickname)
                .HasColumnName("nickname")
                .IsRequired()
                .HasMaxLength(128);
            modelBuilder
                .Entity<Discriminator>()
                .Property(d => d.Value)
                .HasColumnName("value")
                .IsRequired()
                .HasMaxLength(128);
            modelBuilder
                .Entity<Discriminator>()
                .HasIndex(d => new { d.Nickname, d.Value })
                .IsUnique();

            modelBuilder.Entity<Friend>().ToTable("friends");
            modelBuilder.Entity<Friend>().HasKey(f => new { f.UserId, f.FriendId });
            modelBuilder
                .Entity<Friend>()
                .Property(f => f.UserId)
                .HasColumnName("user_id")
                .IsRequired();
            modelBuilder
                .Entity<Friend>()
                .Property(f => f.FriendId)
                .HasColumnName("friend_id")
                .IsRequired();
            modelBuilder
                .Entity<Friend>()
                .Property(f => f.Status)
                .HasColumnName("status")
                .IsRequired()
                .HasMaxLength(20);

            modelBuilder.Entity<Friend>().Property(f => f.Status).HasConversion<int>();

            modelBuilder.Entity<TypingStatus>().ToTable("typing_statuses");
            modelBuilder
                .Entity<TypingStatus>()
                .HasKey(ts => new
                {
                    ts.UserId,
                    ts.GuildId,
                    ts.ChannelId,
                });
            modelBuilder.Entity<TypingStatus>().Property(ts => ts.UserId).IsRequired();
            modelBuilder.Entity<TypingStatus>().Property(ts => ts.GuildId).IsRequired();
            modelBuilder.Entity<TypingStatus>().Property(ts => ts.ChannelId).IsRequired();

            modelBuilder.Entity<UserDm>().ToTable("user_dms");
            modelBuilder.Entity<UserDm>().HasKey(ud => new { ud.UserId, ud.FriendId });
            modelBuilder
                .Entity<UserDm>()
                .HasOne<User>()
                .WithMany()
                .HasForeignKey(ud => ud.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder
                .Entity<UserDm>()
                .HasOne<User>()
                .WithMany()
                .HasForeignKey(ud => ud.FriendId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<GuildMember>().HasKey(gu => new { gu.GuildId, gu.MemberId });

            modelBuilder
                .Entity<GuildMember>()
                .HasOne(gu => gu.Guild)
                .WithMany(g => g.GuildMembers)
                .HasForeignKey(gu => gu.GuildId);

            modelBuilder
                .Entity<GuildMember>()
                .HasOne(gu => gu.User)
                .WithMany()
                .HasForeignKey(gu => gu.MemberId);

            modelBuilder.Entity<FileBase>(entity =>
            {
                entity.HasKey(f => f.FileId);
                entity.Property(f => f.FileId).HasColumnName("file_id").IsRequired();
                entity.Property(f => f.FileName).HasColumnName("file_name");
                entity.Property(f => f.GuildId).HasColumnName("guild_id");
                entity.Property(f => f.Content).HasColumnName("content").IsRequired();
                entity.Property(f => f.Extension).HasColumnName("extension").IsRequired();
            });

            modelBuilder.Entity<AttachmentFile>(entity =>
            {
                entity.ToTable("attachment_files");
                entity.Property(f => f.ChannelId).HasColumnName("channel_id");
                entity.Property(f => f.UserId).HasColumnName("user_id");
            });

            modelBuilder.Entity<EmojiFile>(entity =>
            {
                entity.ToTable("emoji_files");
            });

            modelBuilder.Entity<GuildFile>(entity =>
            {
                entity.ToTable("guild_files");
                entity.Property(f => f.UserId).HasColumnName("user_id");
            });

            modelBuilder.Entity<ProfileFile>(entity =>
            {
                entity.ToTable("profile_files");
                entity.Property(f => f.UserId).HasColumnName("user_id");
            });

            modelBuilder.Entity<UserChannel>().ToTable("user_channels");
            modelBuilder.Entity<UserChannel>().HasKey(uc => new { uc.UserId, uc.ChannelId });
            modelBuilder
                .Entity<UserChannel>()
                .HasOne(uc => uc.User)
                .WithMany(u => u.UserChannels)
                .HasForeignKey(uc => uc.UserId);
            modelBuilder
                .Entity<UserChannel>()
                .HasOne(uc => uc.Channel)
                .WithMany(c => c.UserChannels)
                .HasForeignKey(uc => uc.ChannelId);

            modelBuilder
                .Entity<GuildPermissions>()
                .ToTable("guild_permissions")
                .HasKey(gp => new { gp.GuildId, gp.UserId });

            modelBuilder.Entity<GuildPermissions>().Property(gp => gp.GuildId).IsRequired();

            modelBuilder.Entity<GuildPermissions>().Property(gp => gp.UserId).IsRequired();

            modelBuilder
                .Entity<GuildPermissions>()
                .HasOne(gp => gp.User)
                .WithMany(u => u.GuildPermissions)
                .HasForeignKey(gp => gp.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder
                .Entity<GuildPermissions>()
                .HasOne(gp => gp.Guild)
                .WithMany(g => g.GuildPermissions)
                .HasForeignKey(gp => gp.GuildId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Channel>(entity =>
            {
                entity.ToTable("channels");
                entity.HasKey(c => c.ChannelId);
                entity.Property(c => c.ChannelId).HasColumnName("channel_id").IsRequired();
                entity
                    .Property(c => c.ChannelName)
                    .HasColumnName("channel_name")
                    .IsRequired()
                    .HasMaxLength(128);
                entity
                    .Property(c => c.ChannelDescription)
                    .HasColumnName("channel_description")
                    .HasMaxLength(256);
                entity.Property(c => c.IsTextChannel).HasColumnName("is_text_channel").IsRequired();
                entity.Property(c => c.LastReadDateTime).HasColumnName("last_read_datetime");
                entity.Property(c => c.GuildId).HasColumnName("guild_id").IsRequired();
                entity.Property(c => c.Order).HasColumnName("order").IsRequired();

                entity.HasIndex(c => c.GuildId);
                entity
                    .HasOne(c => c.Guild)
                    .WithMany(g => g.Channels)
                    .HasForeignKey(c => c.GuildId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Guild>(entity =>
            {
                entity.ToTable("guilds");
                entity.HasKey(g => g.GuildId);
                entity.Property(g => g.GuildId).HasColumnName("guild_id").IsRequired();
                entity.Property(g => g.OwnerId).HasColumnName("owner_id").IsRequired();
                entity
                    .Property(g => g.GuildName)
                    .HasColumnName("guild_name")
                    .IsRequired()
                    .HasMaxLength(128);
                entity.Property(g => g.CreatedAt).HasColumnName("created_at").IsRequired();
                entity.Property(g => g.RootChannel).HasColumnName("root_channel").IsRequired();
                entity.Property(g => g.Region).HasColumnName("region").HasMaxLength(64);
                entity.Property(g => g.Settings).HasColumnName("settings").HasMaxLength(1024);
                entity
                    .Property(g => g.IsGuildUploadedImg)
                    .HasColumnName("is_guild_uploaded_img")
                    .IsRequired();

                entity.HasIndex(g => g.OwnerId);
            });

            modelBuilder.Entity<Message>(entity =>
            {
                entity.ToTable("messages");
                entity.HasKey(m => m.MessageId);
                entity.Property(m => m.MessageId).HasColumnName("message_id").IsRequired();
                entity.Property(m => m.UserId).HasColumnName("user_id").IsRequired();
                entity.Property(m => m.ChannelId).HasColumnName("channel_id").IsRequired();
                entity
                    .Property(m => m.Content)
                    .HasColumnName("content")
                    .IsRequired()
                    .HasMaxLength(2000);
                entity.Property(m => m.Date).HasColumnName("date").IsRequired();
                entity.Property(m => m.LastEdited).HasColumnName("last_edited");
                entity
                    .Property(m => m.AttachmentUrls)
                    .HasColumnName("attachment_urls")
                    .HasMaxLength(2048);
                entity.Property(m => m.ReplyToId).HasColumnName("reply_to_id");
                entity
                    .Property(m => m.ReactionEmojisIds)
                    .HasColumnName("reaction_emojis_ids")
                    .HasMaxLength(512);

                entity.HasIndex(m => new
                {
                    m.ChannelId,
                    m.Date,
                    m.MessageId,
                });
                entity
                    .HasOne(m => m.User)
                    .WithMany()
                    .HasForeignKey(m => m.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity
                    .HasOne(m => m.Channel)
                    .WithMany()
                    .HasForeignKey(m => m.ChannelId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity
                    .Property(e => e.Metadata)
                    .HasConversion(
                        v =>
                            JsonSerializer.Serialize(
                                v,
                                new JsonSerializerOptions
                                {
                                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
                                }
                            ),
                        v =>
                            JsonSerializer.Deserialize<Metadata>(
                                v,
                                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                            )
                    )
                    .HasColumnType("json");
            });
        }
    }
}
