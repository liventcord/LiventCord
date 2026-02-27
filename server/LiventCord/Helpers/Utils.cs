using System.ComponentModel.DataAnnotations;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using LiventCord.Controllers;
using LiventCord.Helpers;

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
            return new ValidationResult(
                $"The {validationContext.MemberName ?? "value"} is required and cannot be null or empty."
            );
        }

        if (id.Length != _idLength)
        {
            return new ValidationResult(
                $"The {validationContext.MemberName ?? "value"} must be exactly {_idLength} characters long."
            );
        }

        return ValidationResult.Success;
    }
}

public class UserIdLengthValidationAttribute : BaseIdLengthValidationAttribute
{
    public UserIdLengthValidationAttribute()
        : base(Utils.USER_ID_LENGTH) { }
}

public class IdLengthValidationAttribute : BaseIdLengthValidationAttribute
{
    public IdLengthValidationAttribute()
        : base(Utils.ID_LENGTH) { }
}

namespace LiventCord.Helpers
{
    public static partial class Utils
    {
        public static string DefaultJwtKey =
            "9cb2c90f2f8f10041efc1a40d7d126f2faa1ce67363dfacbb252d7cb7909ae71";
        public static string SystemId = "1";
        private static readonly Random _random = new();
        public static int ID_LENGTH = 19;
        public static int USER_ID_LENGTH = 18;

        public static string CreateRandomId()
        {
            Span<char> result = stackalloc char[ID_LENGTH];
            result[0] = (char)('0' + _random.Next(1, 10));
            for (int i = 1; i < ID_LENGTH; i++)
            {
                result[i] = (char)('0' + _random.Next(0, 10));
            }
            return new string(result);
        }

        public static string CreateRandomIdSecure()
        {
            byte[] randomBytes = new byte[16];
            RandomNumberGenerator.Fill(randomBytes);
            return Convert.ToBase64String(randomBytes);
        }

        public static string CreateRandomUserId()
        {
            Span<char> result = stackalloc char[USER_ID_LENGTH];
            result[0] = (char)('0' + _random.Next(1, 10));
            for (int i = 1; i < USER_ID_LENGTH; i++)
            {
                result[i] = (char)('0' + _random.Next(0, 10));
            }
            return new string(result);
        }

        public static bool IsValidId(string input)
        {
            return !string.IsNullOrEmpty(input)
                && input.Length == 19
                && Regex.IsMatch(input, "^\\d{19}$");
        }

        public static string SanitizeFileName(string fileName)
        {
            return new string(fileName.Where(c => c >= 32 && c <= 126).ToArray());
        }

        public static string? SanitizeLogInput(string input)
        {
            return input?.Replace(Environment.NewLine, " ").Replace("\r", " ").Replace("\n", " ");
        }

        public static bool IsPostgres(AppDbContext _context)
        {
            return _context.Database.ProviderName?.Contains("Npgsql") == true;
        }

        public static string GenerateDmChannelId(string userId, string recipientId)
        {
            var userIds = new List<string> { userId, recipientId };
            userIds.Sort();
            return string.Join("", userIds);
        }

        static readonly Regex UrlPattern = new Regex(
            @"https://[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+(?<![.,;:'\])\s])",
            RegexOptions.IgnoreCase | RegexOptions.Compiled
        );
        static readonly Regex ControlCharPattern = new Regex(
            @"[\x00-\x1F\x7F\u2000-\u20FF]",
            RegexOptions.Compiled
        );

        public static List<string> ExtractUrls(string input)
        {
            return UrlPattern
                .Matches(input)
                .Cast<Match>()
                .Select(m => m.Value)
                .Where(url => !ControlCharPattern.IsMatch(url))
                .ToList();
        }

        public static string GetProcessUptime()
        {
            using (Process process = Process.GetCurrentProcess())
            {
                var date = DateTime.Now - process.StartTime;
                return date.ToString();
            }
        }

        public static List<string> ExtractLinks(string? content)
        {
            if (string.IsNullOrEmpty(content))
                return new List<string>();

            var urls = new List<string>();
            var regex = new Regex(@"https?://[^\s]+", RegexOptions.IgnoreCase);
            var matches = regex.Matches(content);
            foreach (Match match in matches)
            {
                urls.Add(match.Value);
            }
            return urls;
        }
    }
}
