using System.Security.Claims;
using LiventCord.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    public abstract class BaseController : ControllerBase
    {
        protected string? UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }

    [Route("auth")]
    [ApiController]
    public class LoginController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly string _secretKey;

        public LoginController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            var appSecretKey = configuration["AppSettings:SecretKey"];
            _secretKey = appSecretKey ?? "DefaultSecretKey";

            if (appSecretKey == null)
            {
                Console.WriteLine(
                    "Using the default 'SecretKey' in AppSettings. This is not recommended for production."
                );
            }
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

            return Ok(new { message = "Login successful!" });
        }

        private async Task<User?> AuthenticateUser(string email, string password)
        {
            var user = await _context.Users.SingleOrDefaultAsync(u =>
                u.Email.ToLower() == email.ToLower()
            );
            return user != null && BCrypt.Net.BCrypt.Verify(password, user.Password) ? user : null;
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Ok(new { message = "Logout successful!" });
        }
    }
}
