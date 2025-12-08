using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LiventCord.Models
{
    public class GuildMember
    {
        [Key]
        [Column("guild_id")]
        public required string GuildId { get; set; }

        [Key]
        [Column("user_id")]
        public required string MemberId { get; set; }

        public virtual required Guild Guild { get; set; }

        public virtual required User User { get; set; }
    }
}
