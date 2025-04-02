using System.ComponentModel.DataAnnotations;

namespace LiventCord.Models
{
    public class ChangePasswordRequest
    {

        [Required(ErrorMessage = "Password is required.")]
        [StringLength(
            128,
            MinimumLength = 5,
            ErrorMessage = "Password must be between 5 and 128 characters."
        )]
        public required string CurrentPassword { get; set; }

        [Required(ErrorMessage = "New Password is required.")]
        [StringLength(
            128,
            MinimumLength = 5,
            ErrorMessage = "New Password must be between 5 and 128 characters."
        )]
        public required string NewPassword { get; set; }
    }
}
