using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

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

        [Required]
        [StringLength(128)]
        [Column("status")]
        public string? Status { get; set; }

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
        public string? Location { get; set; }

        [StringLength(10)]
        [Column("language")]
        public string? Language { get; set; }

        [StringLength(15)]
        [Column("phone_number")]
        public string? PhoneNumber { get; set; }

        [StringLength(512)]
        [Column("social_media_links")]
        public string? SocialMediaLinks { get; set; }

        public PublicUser GetPublicUser()
        {
            return new PublicUser
            {
                UserId = UserId,
                NickName = Nickname,
                Discriminator = Discriminator,
                Status = Status,
                IsOnline =  IsOnline(),
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

        public bool IsOnline() {
            return true;
        }
    }

    public class PublicUser
    {
        public bool IsOnline;
        public string? Description;

        public required string Discriminator { get; set; }

        public required string UserId { get; set; }
        public required string NickName { get; set; }
        public string? Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? Location { get; set; }
        public string? SocialMediaLinks { get; set; }
    }
}
