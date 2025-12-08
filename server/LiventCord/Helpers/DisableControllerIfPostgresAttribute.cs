using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using LiventCord.Controllers;
using LiventCord.Helpers;

public class DisableControllerIfPostgresAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var dbContext = context.HttpContext.RequestServices.GetService<AppDbContext>();
        if (dbContext != null && Utils.IsPostgres(dbContext))
        {
            context.Result = new NotFoundObjectResult("FileServeController disabled for Postgres DBs");
        }
    }
}
