using System.ComponentModel.DataAnnotations.Schema;

namespace LiventCord.Models
{
    [Table("guild_permissions")]
    public class GuildPermissions
    {
        [ForeignKey("Guild")]
        [Column("guild_id")]
        public required string GuildId { get; set; }
        public virtual Guild? Guild { get; set; }

        [ForeignKey("User")]
        [Column("user_id")]
        public required string UserId { get; set; }
        public virtual User? User { get; set; }
        public PermissionFlags Permissions { get; set; }
    }
}
