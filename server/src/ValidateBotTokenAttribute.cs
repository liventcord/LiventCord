using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

public class ValidateBotTokenAttribute : Attribute, IAsyncActionFilter
{
    private readonly string _headerName = "Authorization";

    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next
    )
    {
        var request = context.HttpContext.Request;

        if (!request.Headers.TryGetValue(_headerName, out var token) || string.IsNullOrEmpty(token))
        {
            context.Result = new ForbidResult();
            return;
        }

        var tokenValidator =
            context.HttpContext.RequestServices.GetService<ITokenValidationService>();
        if (tokenValidator == null || !tokenValidator.ValidateToken(token.ToString()))
        {
            context.Result = new ForbidResult();
            return;
        }

        await next();
    }
}
