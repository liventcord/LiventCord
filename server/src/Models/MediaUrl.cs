using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

public class MediaUrl
{
    [Key]
    [JsonPropertyName("url")]
    public string Url { get; set; }

    [JsonPropertyName("isImage")]
    public bool IsImage { get; set; }

    [JsonPropertyName("isVideo")]
    public bool IsVideo { get; set; }

    [JsonPropertyName("fileName")]
    public string FileName { get; set; }

    [JsonPropertyName("fileSize")]
    public long FileSize { get; set; }

    [JsonPropertyName("width")]
    public int? Width { get; set; }

    [JsonPropertyName("height")]
    public int? Height { get; set; }

    public MediaUrl(string url, string fileName, long fileSize)
    {
        Url = url ?? throw new ArgumentNullException(nameof(url));
        FileName = fileName ?? throw new ArgumentNullException(nameof(fileName));
        FileSize = fileSize;
    }
}
