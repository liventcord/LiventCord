using Microsoft.AspNetCore.Mvc;

public class RequestCountingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IAppStatsService _statsService;

    public RequestCountingMiddleware(RequestDelegate next, IAppStatsService statsService)
    {
        _next = next;
        _statsService = statsService;
    }
    [NonAction]
    public async Task InvokeAsync(HttpContext context)
    {
        await _next(context);
        if (!context.Request.Path.StartsWithSegments("/health"))
        {
            _statsService.IncrementRespondedRequests();
        }
    }
}
