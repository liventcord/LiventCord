using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace LiventCord.Models
{
    public class Message
    {
        [Key]
        [Column("message_id")]
        public required string MessageId { get; set; }

        [ForeignKey("User")]
        public required string UserId { get; set; }

        [ForeignKey("Channel")]
        public required string ChannelId { get; set; }

        public required string Content { get; set; }

        public required DateTime Date { get; set; }

        public DateTime? LastEdited { get; set; }

        public string? AttachmentUrls { get; set; }

        public string? ReplyToId { get; set; }

        public string? ReactionEmojisIds { get; set; }
        public Metadata? Metadata { get; set; }

        [JsonIgnore]
        public virtual User User { get; set; } = null!;

        [JsonIgnore]
        public virtual Channel Channel { get; set; } = null!;
        public Embed? Embed { get; set; } 
    }
}

