using System.ComponentModel.DataAnnotations;

public class ChangeNicknameRequest
{
    [Required]
    [MinLength(1)]
    [MaxLength(32)]
    public required string NewNickname { get; set; }
}
