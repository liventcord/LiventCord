using System.Security.Claims;
using LiventCord.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;

namespace LiventCord.Controllers
{
    public abstract class BaseController : ControllerBase
    {
        protected string? UserId
        {
            get
            {
                var userId = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    throw new UnauthorizedAccessException("User is not authenticated.");
                }
                return userId;
            }
        }
    }

    [Route("auth")]
    [ApiController]
    public class LoginController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PasswordHasher<User> _passwordHasher;

        public LoginController(AppDbContext context)
        {
            _context = context;
            _passwordHasher = new PasswordHasher<User>();
        }

        [HttpPost("login")]
        public async Task<IActionResult> LoginAuth([FromForm] LoginRequest loginRequest)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var user = await AuthenticateUser(loginRequest.Email, loginRequest.Password);
            if (user == null)
                return Unauthorized(new { message = "Authentication failed!" });

            var claims = new List<Claim>
            {
                new(ClaimTypes.Email, loginRequest.Email),
                new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            };

            var claimsIdentity = new ClaimsIdentity(
                claims,
                CookieAuthenticationDefaults.AuthenticationScheme
            );
            var authProperties = new AuthenticationProperties { IsPersistent = true };

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(claimsIdentity),
                authProperties
            );

            return Ok();
        }

        private async Task<User?> AuthenticateUser(string email, string password)
        {
            var user = await _context.Users.SingleOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());
            if (user == null) return null;

            if (string.IsNullOrEmpty(user.Password))
                return null;

            var result = _passwordHasher.VerifyHashedPassword(user, user.Password, password);
            return result == PasswordVerificationResult.Success ? user : null;
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            try
            {
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return Ok();
            }
            catch (NullReferenceException)
            {
                return Ok();
            }
        }
        [HttpPost("validate-session")]
        public async Task<IActionResult> ValidateSession([FromHeader(Name = "Cookie")] string cookieHeader)
        {
            if (string.IsNullOrEmpty(cookieHeader))
            {
                return Unauthorized(new { message = "Missing cookie" });
            }

            string cookieValue = ExtractAspNetCoreCookie(cookieHeader);

            if (string.IsNullOrEmpty(cookieValue))
            {
                return Unauthorized(new { message = "Invalid cookie value" });
            }

            var user = await ValidateUserFromCookie(cookieValue);

            if (user == null)
            {
                return Unauthorized(new { message = "Invalid session" });
            }

            return Ok(user.UserId);
        }

        public async Task<User?> ValidateUserFromCookie(string cookieValue)
        {
            try
            {
                var result = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);

                if (result.Succeeded)
                {
                    var claimsPrincipal = result.Principal;
                    if (claimsPrincipal?.Identity?.IsAuthenticated == true)
                    {
                        var userIdClaim = claimsPrincipal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        if (string.IsNullOrEmpty(userIdClaim))
                            return null;
                        var user = await _context.Users
                            .SingleOrDefaultAsync(u => u.UserId == userIdClaim);

                        return user;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex + "Error validating user from cookie.");
            }

            return null;
        }

        private string ExtractAspNetCoreCookie(string cookieHeader)
        {
            var cookies = cookieHeader.Split("; ");
            foreach (var cookie in cookies)
            {
                if (cookie.StartsWith(".AspNetCore.Cookies="))
                {
                    return cookie.Substring(".AspNetCore.Cookies=".Length);
                }
            }
            return string.Empty;
        }



    }
}
