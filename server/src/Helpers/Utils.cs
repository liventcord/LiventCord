using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using LiventCord.Helpers;
using System.Security.Cryptography;
public abstract class BaseIdLengthValidationAttribute : ValidationAttribute
{
    private readonly int _idLength;

    protected BaseIdLengthValidationAttribute(int idLength)
        : base($"The value must be {idLength} characters long and cannot be null or empty.")
    {
        _idLength = idLength;
    }

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is not string id || string.IsNullOrWhiteSpace(id))
        {
            return new ValidationResult($"The {validationContext.MemberName ?? "value"} is required and cannot be null or empty.");
        }

        if (id.Length != _idLength)
        {
            return new ValidationResult($"The {validationContext.MemberName ?? "value"} must be exactly {_idLength} characters long.");
        }

        return ValidationResult.Success;
    }
}

public class UserIdLengthValidationAttribute : BaseIdLengthValidationAttribute
{
    public UserIdLengthValidationAttribute() : base(Utils.USER_ID_LENGTH) { }
}

public class IdLengthValidationAttribute : BaseIdLengthValidationAttribute
{
    public IdLengthValidationAttribute() : base(Utils.ID_LENGTH) { }
}
namespace LiventCord.Helpers
{
    public static partial class Utils
    {
        public static int ID_LENGTH = 19;

        public static int USER_ID_LENGTH = 18;

        public static string CreateRandomId()
        {
            Random random = new();
            string result = string.Empty;


            result += random.Next(1, 10).ToString();

            for (int i = 1; i < ID_LENGTH; i++)
            {
                result += random.Next(0, 10).ToString();
            }

            return result;
        }


        public static string CreateRandomIdSecure()
        {
            using (var rng = RandomNumberGenerator.Create())
            {
                byte[] randomBytes = new byte[16];
                rng.GetBytes(randomBytes);

                return Convert.ToBase64String(randomBytes);
            }
        }


        public static string CreateRandomUserId()
        {
            Random random = new();
            string result = string.Empty;


            result += random.Next(1, 10).ToString();

            for (int i = 1; i < USER_ID_LENGTH; i++)
            {
                result += random.Next(0, 10).ToString();
            }

            return result;
        }

        public static bool IsValidId(string input)
        {
            if (string.IsNullOrEmpty(input))
                return false;
            return input.Length == 19 && Regex.IsMatch(input, @"^\d{19}$");
        }

        public static string SanitizeFileName(string fileName)
        {
            return new string(fileName.Where(c => c >= 32 && c <= 126).ToArray());
        }
    }
}
