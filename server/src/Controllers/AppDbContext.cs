using System.Text.Json;
using System.Text.Json.Serialization;
using LiventCord.Models;
using Microsoft.EntityFrameworkCore;
using LiventCord.Helpers;


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
        public DbSet<UrlStatus> UrlStatuses { get; set; }

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

        public async Task<string[]> GetGuildUserIds(string guildId, string? userIdToExclude)
        {
            var query = Set<GuildMember>().Where(gm => gm.GuildId == guildId);

            if (!string.IsNullOrEmpty(userIdToExclude))
            {
                query = query.Where(gm => gm.MemberId != userIdToExclude);
            }

            return await query.Select(gm => gm.MemberId).ToArrayAsync();
        }

        public async Task<bool> CheckFriendship(string userId, string friendUserId)
        {
            return await Friends.AnyAsync(f =>
                (f.UserId == userId && f.FriendId == friendUserId)
                || (f.UserId == friendUserId && f.FriendId == userId)
            );
        }


        public async Task<bool> IsGuildPublic(string guildId)
        {
            if (string.IsNullOrEmpty(guildId))
                return false;

            return await Guilds.AnyAsync(g => g.GuildId == guildId && g.IsPublic);
        }

        public User CreateDummyUser(string userId)
        {
            var newUser = new User
            {
                UserId = userId,
                Nickname = "BotCreatedUser_" + userId[..6],
                CreatedAt = DateTime.UtcNow,
                Email = Utils.CreateRandomId(),
                Discriminator = "0000",
                Password = Utils.CreateRandomIdSecure()
            };

            return newUser;
        }


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable(nameof(User));
                entity.HasKey(u => u.UserId);
                entity.Property(u => u.UserId).HasColumnName(nameof(User.UserId)).IsRequired();
                entity.Property(u => u.Email).HasColumnName(nameof(User.Email)).IsRequired().HasMaxLength(128);
                entity.Property(u => u.Password).HasColumnName(nameof(User.Password)).IsRequired().HasMaxLength(128);
                entity.Property(u => u.Nickname).HasColumnName(nameof(User.Nickname)).HasMaxLength(128);
                entity.HasIndex(u => u.Email).IsUnique();
            });

            modelBuilder.Entity<Discriminator>(entity =>
            {
                entity.ToTable(nameof(Discriminator));
                entity.HasKey(d => d.Id);
                entity.Property(d => d.Nickname).HasColumnName(nameof(Discriminator.Nickname)).IsRequired().HasMaxLength(128);
                entity.Property(d => d.Value).HasColumnName(nameof(Discriminator.Value)).IsRequired().HasMaxLength(128);
                entity.HasIndex(d => new { d.Nickname, d.Value }).IsUnique();
            });

            modelBuilder.Entity<Friend>(entity =>
            {
                entity.ToTable(nameof(Friend));
                entity.HasKey(f => new { f.UserId, f.FriendId });
                entity.Property(f => f.UserId).HasColumnName(nameof(Friend.UserId)).IsRequired();
                entity.Property(f => f.FriendId).HasColumnName(nameof(Friend.FriendId)).IsRequired();
                entity.Property(f => f.Status).HasColumnName(nameof(Friend.Status)).IsRequired().HasMaxLength(20);
                entity.Property(f => f.Status).HasConversion<int>();
            });

            modelBuilder.Entity<TypingStatus>(entity =>
            {
                entity.ToTable(nameof(TypingStatus));
                entity.HasKey(ts => new { ts.UserId, ts.GuildId, ts.ChannelId });
                entity.Property(ts => ts.UserId).IsRequired();
                entity.Property(ts => ts.GuildId).IsRequired();
                entity.Property(ts => ts.ChannelId).IsRequired();
            });

            modelBuilder.Entity<UserDm>().ToTable(nameof(UserDm));
            modelBuilder.Entity<UserDm>().HasKey(ud => new { ud.UserId, ud.FriendId });
            modelBuilder.Entity<UserDm>()
                .HasOne<User>()
                .WithMany()
                .HasForeignKey(ud => ud.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<UserDm>()
                .HasOne<User>()
                .WithMany()
                .HasForeignKey(ud => ud.FriendId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<FileBase>(entity =>
            {
                entity.HasKey(f => f.FileId);
                entity.Property(f => f.FileId).HasColumnName(nameof(FileBase.FileId)).IsRequired();
                entity.Property(f => f.FileName).HasColumnName(nameof(FileBase.FileName));
                entity.Property(f => f.GuildId).HasColumnName(nameof(FileBase.GuildId));
                entity.Property(f => f.Content).HasColumnName(nameof(FileBase.Content)).IsRequired();
                entity.Property(f => f.Extension).HasColumnName(nameof(FileBase.Extension)).IsRequired();
            });

            modelBuilder.Entity<AttachmentFile>(entity =>
            {
                entity.ToTable(nameof(AttachmentFile));
                entity.Property(f => f.ChannelId).HasColumnName(nameof(AttachmentFile.ChannelId));
                entity.Property(f => f.UserId).HasColumnName(nameof(AttachmentFile.UserId));
            });

            modelBuilder.Entity<EmojiFile>().ToTable(nameof(EmojiFile));
            modelBuilder.Entity<GuildFile>().ToTable(nameof(GuildFile));
            modelBuilder.Entity<ProfileFile>().ToTable(nameof(ProfileFile));

            modelBuilder.Entity<GuildFile>(entity =>
            {
                entity.Property(f => f.UserId).HasColumnName(nameof(GuildFile.UserId));
            });

            modelBuilder.Entity<ProfileFile>(entity =>
            {
                entity.Property(f => f.UserId).HasColumnName(nameof(ProfileFile.UserId));
            });

            modelBuilder.Entity<GuildMember>().HasKey(gu => new { gu.GuildId, gu.MemberId });
            modelBuilder.Entity<GuildMember>()
                .HasOne(gu => gu.Guild)
                .WithMany(g => g.GuildMembers)
                .HasForeignKey(gu => gu.GuildId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<GuildMember>()
                .HasOne(gu => gu.User)
                .WithMany()
                .HasForeignKey(gu => gu.MemberId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserChannel>().ToTable(nameof(UserChannel));
            modelBuilder.Entity<UserChannel>().HasKey(uc => new { uc.UserId, uc.ChannelId });
            modelBuilder.Entity<UserChannel>()
                .HasOne(uc => uc.User)
                .WithMany(u => u.UserChannels)
                .HasForeignKey(uc => uc.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<UserChannel>()
                .HasOne(uc => uc.Channel)
                .WithMany(c => c.UserChannels)
                .HasForeignKey(uc => uc.ChannelId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<GuildPermissions>()
                .ToTable(nameof(GuildPermissions))
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
                entity.ToTable(nameof(Channel));
                entity.HasKey(c => c.ChannelId);
                entity.Property(c => c.ChannelId).HasColumnName(nameof(Channel.ChannelId)).IsRequired();
                entity.Property(c => c.ChannelName).HasColumnName(nameof(Channel.ChannelName)).IsRequired().HasMaxLength(128);
                entity.Property(c => c.ChannelDescription).HasColumnName(nameof(Channel.ChannelDescription)).HasMaxLength(256);
                entity.Property(c => c.IsTextChannel).HasColumnName(nameof(Channel.IsTextChannel)).IsRequired();
                entity.Property(c => c.LastReadDateTime).HasColumnName(nameof(Channel.LastReadDateTime));
                entity.Property(c => c.GuildId).HasColumnName(nameof(Channel.GuildId)).IsRequired();
                entity.Property(c => c.Order).HasColumnName(nameof(Channel.Order)).IsRequired();
                entity.HasIndex(c => c.GuildId);
                entity.HasOne(c => c.Guild).WithMany(g => g.Channels).HasForeignKey(c => c.GuildId).OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Guild>(entity =>
            {
                entity.ToTable(nameof(Guild));
                entity.HasKey(g => g.GuildId);
                entity.Property(g => g.GuildId).HasColumnName(nameof(Guild.GuildId)).IsRequired();
                entity.Property(g => g.OwnerId).HasColumnName(nameof(Guild.OwnerId)).IsRequired();
                entity.Property(g => g.GuildName).HasColumnName(nameof(Guild.GuildName)).IsRequired().HasMaxLength(128);
                entity.Property(g => g.CreatedAt).HasColumnName(nameof(Guild.CreatedAt)).IsRequired();
                entity.Property(g => g.RootChannel).HasColumnName(nameof(Guild.RootChannel)).IsRequired();
                entity.Property(g => g.Region).HasColumnName(nameof(Guild.Region)).HasMaxLength(64);
                entity.Property(g => g.Settings).HasColumnName(nameof(Guild.Settings)).HasMaxLength(1024);
                entity.Property(g => g.IsGuildUploadedImg).HasColumnName(nameof(Guild.IsGuildUploadedImg)).IsRequired();
                entity.HasIndex(g => g.OwnerId);
                entity.HasMany(g => g.GuildMembers).WithOne(gu => gu.Guild).HasForeignKey(gu => gu.GuildId).OnDelete(DeleteBehavior.Cascade);
                entity.HasMany(g => g.GuildPermissions).WithOne(gp => gp.Guild).HasForeignKey(gp => gp.GuildId).OnDelete(DeleteBehavior.Cascade);
                entity.HasMany(g => g.Channels).WithOne(c => c.Guild).HasForeignKey(c => c.GuildId).OnDelete(DeleteBehavior.Cascade);
            });



            modelBuilder.Entity<Message>(entity =>
            {
                entity.ToTable(typeof(Message).Name.ToLower());
                entity.HasKey(m => m.MessageId);
                entity.Property(m => m.MessageId).IsRequired();
                entity.Property(m => m.UserId).IsRequired();
                entity.Property(m => m.ChannelId).IsRequired();
                entity.Property(m => m.Content)
                    .IsRequired()
                    .HasMaxLength(2000);
                entity.Property(m => m.Date).IsRequired();
                entity.Property(m => m.LastEdited);
                entity.Property(m => m.AttachmentUrls);
                entity.Property(m => m.ReplyToId);
                entity.Property(m => m.ReactionEmojisIds).HasMaxLength(512);

                entity.HasIndex(m => new { m.ChannelId, m.Date, m.MessageId });

                entity.HasOne(m => m.User)
                    .WithMany()
                    .HasForeignKey(m => m.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(m => m.Channel)
                    .WithMany()
                    .HasForeignKey(m => m.ChannelId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.Property(m => m.Metadata)
                    .HasConversion(
                        v => JsonSerializer.Serialize(v, new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull }),
                        v => JsonSerializer.Deserialize<Metadata>(v, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                    )
                    .HasColumnType("json");

                entity.OwnsMany(m => m.Embeds, embed =>
                {
                    embed.WithOwner().HasForeignKey("MessageId");
                    embed.HasKey("MessageId", "Id");

                    embed.Property(e => e.Id).IsRequired();

                    embed.Property(e => e.Title);
                    embed.Property(e => e.Type).HasDefaultValue(EmbedType.Rich);
                    embed.Property(e => e.Description);
                    embed.Property(e => e.Url);
                    embed.Property(e => e.Color).HasDefaultValue(0x808080);

                    embed.OwnsOne(e => e.Author, author =>
                    {
                        author.Property(a => a.Name).IsRequired();
                        author.Property(a => a.Url);
                        author.Property(a => a.IconUrl);
                    });

                    embed.OwnsOne(e => e.Thumbnail, thumbnail =>
                    {
                        thumbnail.Property(t => t.Url).IsRequired();
                    });

                    embed.OwnsOne(e => e.Video, video =>
                    {
                        video.Property(v => v.Url).IsRequired();
                        video.Property(v => v.Width);
                        video.Property(v => v.Height);
                    });

                    embed.OwnsOne(e => e.Image, image =>
                    {
                        image.Property(i => i.Url).IsRequired();
                        image.Property(i => i.Width);
                        image.Property(i => i.Height);
                    });

                    embed.OwnsOne(e => e.Footer, footer =>
                    {
                        footer.Property(f => f.Text).IsRequired();
                        footer.Property(f => f.IconUrl);
                    });

                    embed.Property(e => e.Fields)
                        .HasColumnType("json")
                        .HasConversion(
                            v => v != null
                                ? JsonSerializer.Serialize(v, new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull })
                                : null,
                            v => v != null
                                ? JsonSerializer.Deserialize<List<EmbedField>>(v, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<EmbedField>()
                                : new List<EmbedField>()
                        );
                });
            });




        }

    }

}

