using System.ComponentModel.DataAnnotations;

namespace LiventCord.Models
{
    public class RegisterRequest
    {
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Invalid email format.")]
        [StringLength(
            240,
            MinimumLength = 1,
            ErrorMessage = "Email must be between 1 and 240 characters."
        )]
        public required string Email { get; set; }

        [Required(ErrorMessage = "Password is required.")]
        [StringLength(
            128,
            MinimumLength = 5,
            ErrorMessage = "Password must be between 5 and 128 characters."
        )]
        public required string Password { get; set; }

        [Required(ErrorMessage = "Nickname is required.")]
        [StringLength(
            32,
            MinimumLength = 1,
            ErrorMessage = "Nickname must be between 1 and 32 characters."
        )]
        public required string Nickname { get; set; }
    }
}
