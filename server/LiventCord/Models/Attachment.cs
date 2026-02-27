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
}
