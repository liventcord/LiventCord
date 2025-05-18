using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LiventCord.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using LiventCord.Helpers;

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
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PasswordHasher<User> _passwordHasher;
        private readonly string _jwtKey;
        public static string _jwtIssuer = "LiventCord";
        public static string _jwtAudience = "LiventCordClients";
        private readonly int _accessTokenExpiryDays;

        public AuthController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _passwordHasher = new PasswordHasher<User>();
            _jwtKey = configuration["AppSettings:JwtKey"] ?? Utils.DefaultJwtKey;
            if (configuration["AppSettings:JwtKey"] == Utils.DefaultJwtKey)
                _accessTokenExpiryDays = configuration.GetValue<int>("AppSettings:JwtAccessTokenExpiryDays", 7);
        }

        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest changePasswordRequest)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var user = await _context.Users.SingleOrDefaultAsync(u => u.UserId.ToString() == userId);

            if (user == null)
                return NotFound(new { message = "User not found" });

            var currentPasswordVerification = _passwordHasher.VerifyHashedPassword(user, user.Password, changePasswordRequest.CurrentPassword);
            if (currentPasswordVerification != PasswordVerificationResult.Success)
            {
                return BadRequest(new { message = "Current password is incorrect" });
            }

            if (changePasswordRequest.NewPassword == changePasswordRequest.CurrentPassword)
            {
                return BadRequest(new { message = "New password cannot be the same as the current password" });
            }

            var hashedNewPassword = _passwordHasher.HashPassword(user, changePasswordRequest.NewPassword);

            user.Password = hashedNewPassword;

            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            return Ok();
        }

        [HttpPost("login")]
        public async Task<IActionResult> LoginAuth([FromBody] LoginRequest loginRequest)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var user = await AuthenticateUser(loginRequest.Email, loginRequest.Password);
            if (user == null)
                return Unauthorized(new { message = "Authentication failed!" });

            var token = GenerateJwtToken(user);

            return Ok(new { token });
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

        private string GenerateJwtToken(User user)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtKey));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new Claim("purpose", _jwtAudience)
            };

            var expiryTime = DateTime.Now.AddDays(_accessTokenExpiryDays);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = expiryTime,
                Issuer = _jwtIssuer,
                Audience = _jwtAudience,
                SigningCredentials = credentials
            };

            var tokenHandler = new JwtSecurityTokenHandler();
            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        [HttpPost("validate-token")]
        public IActionResult ValidateToken()
        {
            if (User.Identity?.IsAuthenticated != true)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Ok(new { userId });
        }

        [HttpGet("ws-token")]
        [Authorize]
        public IActionResult GetWebsocketToken()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }


            var user = _context.Users.FirstOrDefault(u => u.UserId == userId);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var wsToken = GenerateJwtToken(user);
            return Ok(new { token = wsToken });
        }

    }
}