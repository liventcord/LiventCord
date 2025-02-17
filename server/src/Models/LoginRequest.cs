using System.ComponentModel.DataAnnotations;

namespace LiventCord.Models
{
    public class LoginRequest
    {
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Invalid email format.")]
        [StringLength(
            128,
            MinimumLength = 5,
            ErrorMessage = "Email must be between 5 and 128 characters."
        )]
        public required string Email { get; set; }

        [Required(ErrorMessage = "Password is required.")]
        [StringLength(
            128,
            MinimumLength = 5,
            ErrorMessage = "Password must be between 5 and 128 characters."
        )]
        public required string Password { get; set; }
    }
}
