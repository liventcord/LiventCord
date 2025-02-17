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

        public LoginController(AppDbContext context)
        {
            _context = context;
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
            var user = await _context.Users.SingleOrDefaultAsync(u =>
                u.Email.ToLower() == email.ToLower()
            );
            return user != null && BCrypt.Net.BCrypt.Verify(password, user.Password) ? user : null;
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
    }
}
