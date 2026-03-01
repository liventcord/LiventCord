using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace LiventCord.Models
{

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

    public class PendingAttachmentRef
    {
        public required string FileId { get; set; }
        public bool IsSpoiler { get; set; }
    }

    public class PendingAttachment
    {
        [Key]
        public string FileId { get; set; } = null!;
        public string UserId { get; set; } = null!;
        public string FileName { get; set; } = null!;
        public long FileSize { get; set; }
        public string Extension { get; set; } = null!;
        public bool IsImage { get; set; }
        public bool IsVideo { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool Claimed { get; set; } = false;
    }
}
