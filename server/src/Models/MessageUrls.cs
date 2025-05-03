using System.ComponentModel.DataAnnotations;

public class MessageUrl
{
    [Key]
    public required string MessageId { get; set; }
    public List<string>? Urls { get; set; }
}