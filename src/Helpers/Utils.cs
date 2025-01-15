using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

public class IdLengthValidationAttribute : ValidationAttribute
{
    private const int RequiredLength = 18;

    public IdLengthValidationAttribute()
        : base($"The value must be {RequiredLength} characters long and cannot be null or empty.")
    { }

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is not string id || string.IsNullOrWhiteSpace(id))
        {
            return new ValidationResult(
                $"The {validationContext.MemberName ?? "value"} is required and cannot be null or empty."
            );
        }

        if (id.Length != RequiredLength)
        {
            return new ValidationResult(
                $"The {validationContext.MemberName ?? "value"} must be exactly {RequiredLength} characters long."
            );
        }

        return ValidationResult.Success;
    }
}

namespace LiventCord.Helpers
{
    public static partial class Utils
    {
        public static string CreateRandomId()
        {
            Random random = new();
            string result = string.Empty;
            for (int i = 0; i < 18; i++)
            {
                result += random.Next(0, 10).ToString();
            }
            return result;
        }

        public static bool IsValidId(string input)
        {
            if (string.IsNullOrEmpty(input))
                return false;
            return input.Length == 18 && Regex.IsMatch(input, @"^\d{18}$");
        }
    }
}
