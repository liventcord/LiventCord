using System.ComponentModel.DataAnnotations;

public class ChangeNicknameRequest
{
    [Required]
    [MinLength(1, ErrorMessage = "Nickname must be at least 1 character long.")]
    public required string NewNickname { get; set; }
}
