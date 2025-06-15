public class GoogleLoginRequest
{
    public required string IdToken { get; set; }
}

public class GoogleLinkRequest
{
    public required string IdToken { get; set; }
    public required string Password { get; set; }
}
