using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;

namespace LiventCord.Models
{
    public class User
    {
        [Key]
        [Column("user_id")]
        public required string UserId { get; set; }
        public virtual ICollection<GuildMember>? GuildUsers { get; set; }

        [Required]
        [StringLength(128)]
        [Column("email")]
        [NotMapped]
        public required string Email { get; set; }

        [Column("is_google_user")]
        public bool IsGoogleUser { get; set; } = false;

        [Column("google_id")]
        public string? GoogleId { get; set; }

        [Required]
        [StringLength(4)]
        [Column("discriminator")]
        public required string Discriminator { get; set; }

        [Required]
        [StringLength(128)]
        [Column("password")]
        public required string Password { get; set; }

        [Required]
        [StringLength(32)]
        [Column("nickname")]
        public required string Nickname { get; set; }

        [Required]
        [Column("bot")]
        public int Bot { get; set; }

        [StringLength(256)]
        [Column("description")]
        public string? Description { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("last_login")]
        public DateTime? LastLogin { get; set; } = DateTime.UtcNow;

        [Column("date_of_birth")]
        public DateTime? DateOfBirth { get; set; }

        [Column("verified")]
        public int Verified { get; set; }

        [StringLength(256)]
        [Column("location")]
        [JsonIgnore]
        public string? Location { get; set; }

        [StringLength(10)]
        [Column("language")]
        public string? Language { get; set; }

        [StringLength(512)]
        [Column("social_media_links")]
        public string? SocialMediaLinks { get; set; }

        public static User Create(
            string userId,
            string email,
            string nickname,
            string discriminator,
            string plainPassword,
            IPasswordHasher<User> hasher
        )
        {
            var dummyUser = new User
            {
                UserId = userId,
                Email = email,
                Nickname = nickname,
                Discriminator = discriminator,
                Bot = 0,
                Password = "",
            };

            var hashedPassword = hasher.HashPassword(dummyUser, plainPassword);

            return new User
            {
                UserId = userId,
                Email = email,
                Nickname = nickname,
                Discriminator = discriminator,
                Bot = 0,
                Password = hashedPassword,
            };
        }

        public PublicUser GetPublicUser()
        {
            return new PublicUser
            {
                UserId = UserId,
                NickName = Nickname,
                Discriminator = Discriminator,
                CreatedAt = CreatedAt,
            };
        }

        public void UpdateLastLogin()
        {
            LastLogin = DateTime.UtcNow;
        }

        public virtual ICollection<UserChannel>? UserChannels { get; set; }
        public virtual ICollection<GuildPermissions> GuildPermissions { get; set; } =
            new List<GuildPermissions>();
    }

    public class PublicUser
    {
        public string? UserId { get; set; }
        public string? NickName { get; set; }
        public string? Discriminator { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string? Description { get; set; }
        public string? SocialMediaLinks { get; set; }
        public string? ProfileVersion { get; set; }
    }

    public class PublicUserWithFriendData : PublicUser
    {
        public FriendStatus FriendshipStatus { get; set; }
        public bool IsPending { get; set; }
        public bool IsFriendsRequestToUser { get; set; }
    }
}
