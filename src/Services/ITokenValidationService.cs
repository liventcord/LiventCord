using LiventCord.Helpers;

public interface ITokenValidationService
{
    bool ValidateToken(string token);
}

public class TokenValidationService : ITokenValidationService
{
    private readonly string _botToken;
    private readonly ILogger<TokenValidationService> _logger;

    public TokenValidationService(IConfiguration configuration, ILogger<TokenValidationService> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        
        _botToken = configuration["AppSettings:BotToken"] ?? Utils.CreateRandomId();

        if (string.IsNullOrEmpty(_botToken))
        {
            _botToken = Utils.CreateRandomId();
            _logger.LogInformation("Bot token was unset, generated random id: " + _botToken);
        }
    }

    public bool ValidateToken(string token)
    {
        return token == "Bearer " + _botToken;
    }
}
