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

        [NotMapped]
        public string? TemporaryId { get; set; } // Client generated and used for local display


        [ForeignKey("User")]
        public required string UserId { get; set; }

        [ForeignKey("Channel")]
        public required string ChannelId { get; set; }

        public string? Content { get; set; }

        public required DateTime Date { get; set; }

        public DateTime? LastEdited { get; set; }

        public virtual List<Attachment>? Attachments { get; set; } = new();

        public string? ReplyToId { get; set; }

        public string? ReactionEmojisIds { get; set; }

        public Metadata? Metadata { get; set; }
        public bool? IsSystemMessage { get; set; }

        public bool ShouldSerializeMetadata()
        {
            return Metadata != null && !Metadata.IsEmpty();
        }
        [JsonIgnore]
        public virtual User User { get; set; } = null!;

        [JsonIgnore]
        public virtual Channel Channel { get; set; } = null!;

        public List<Embed> Embeds { get; set; } = new();
        public ICollection<ChannelPinnedMessage> PinnedInChannels { get; set; } = new List<ChannelPinnedMessage>();

    }
    public class Attachment
    {
        [Key]
        public required string FileId { get; set; }

        public required bool IsImageFile { get; set; }
        public bool? IsVideoFile { get; set; }

        public required string MessageId { get; set; }
        public required string FileName { get; set; }
        public required long FileSize { get; set; }
        public required bool IsSpoiler { get; set; }
        public bool? IsProxyFile { get; set; }
        public string? ProxyUrl { get; set; }

        [JsonIgnore]
        public Message Message { get; set; } = null!;

    }

    public class ChannelPinnedMessage
    {
        public string ChannelId { get; set; } = null!;
        public string MessageId { get; set; } = null!;
        public string? PinnedByUserId { get; set; }
        public DateTime PinnedAt { get; set; }

        public Channel Channel { get; set; } = null!;
        public Message Message { get; set; } = null!;
    }





}
