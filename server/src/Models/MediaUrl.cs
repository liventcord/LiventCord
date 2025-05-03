using System.ComponentModel.DataAnnotations;
public class MediaUrl
{
    [Key]
    public required string Url { get; set; }

    public required bool IsImage { get; set; }
    public required bool IsVideo { get; set; }
    public required string FileName { get; set; }
    public required long FileSize { get; set; }
    public required int? Width { get; set; }
    public required int? Height { get; set; }
}
