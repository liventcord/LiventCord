using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("auth")]
    [ApiController]
    public class RegisterController : BaseController
    {
        private readonly AppDbContext _context;
        public string? _googleClientId;
        private readonly NickDiscriminatorController _nickDiscriminatorController;
        private readonly PasswordHasher<User> _passwordHasher;
        private readonly FileController _fileController;

        public RegisterController(
            IConfiguration configuration,
            AppDbContext context,
            NickDiscriminatorController nickDiscriminatorController,
            FileController fileController
            )
        {
            _googleClientId = configuration["AppSettings:GoogleClientId"];
            _context = context;
            _nickDiscriminatorController = nickDiscriminatorController;
            _passwordHasher = new PasswordHasher<User>();
            _fileController = fileController;
        }

        [HttpPost("register")]
        public async Task<IActionResult> RegisterAuth([FromBody] RegisterRequest request)
        {
            if (!ModelState.IsValid || _context.Users.Any(u => u.Email.ToLower() == request.Email.ToLower()))
                return Conflict();

            var discriminator = await _nickDiscriminatorController.GetCachedOrNewDiscriminator(request.Nickname);
            if (discriminator == null)
                return BadRequest("Could not generate discriminator");

            var userId = Utils.CreateRandomUserId();
            var user = Models.User.Create(userId, request.Email, request.Nickname, discriminator, request.Password, _passwordHasher);

            await _context.Users.AddAsync(user);
            await _context.SaveChangesAsync();

            return Ok();
        }
        [NonAction]
        public async Task<User> RegisterByGoogleAsync(string idToken)
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [_googleClientId]
            });

            if (payload == null || !payload.EmailVerified)
                throw new Exception("Invalid Google token or unverified email");

            var email = payload.Email.ToLower();

            if (_context.Users.Any(u => u.Email.ToLower() == email))
                throw new Exception("User already exists");

            var discriminator = await _nickDiscriminatorController.GetCachedOrNewDiscriminator(payload.GivenName);
            if (discriminator == null)
                throw new Exception("Could not generate discriminator");

            var userId = Utils.CreateRandomUserId();

            var dummyPassword = Utils.CreateRandomIdSecure();
            var user = Models.User.Create(userId, email, payload.GivenName, discriminator, dummyPassword, _passwordHasher);
            user.IsGoogleUser = true;

            await _fileController.UploadProfileImageFromGoogle(userId, payload.Picture);

            await _context.Users.AddAsync(user);
            await _context.SaveChangesAsync();

            return user;
        }
        [NonAction]
        public bool isGoogleClientIdNull()
        {
            return _googleClientId == null;
        }
        [NonAction]
        public async Task<User> LoginOrRegisterGoogleUserAsync(string idToken)
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [_googleClientId]
            });

            if (payload == null || !payload.EmailVerified)
                throw new Exception("Invalid Google token or unverified email");

            var email = payload.Email.ToLower();

            var user = await _context.Users.SingleOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user == null)
            {
                user = await RegisterByGoogleAsync(idToken);
            }
            else
            {
                if (!user.IsGoogleUser)
                    throw new AuthConflictException("EMAIL_EXISTS_WITH_PASSWORD");
            }


            return user;
        }
        [NonAction]
        public async Task EnsureSystemUserExistsAsync()
        {
            var systemUserId = Utils.SystemId;
            if (!_context.Users.Any(u => u.UserId == systemUserId))
            {
                var systemUser = Models.User.Create(
                    systemUserId,
                    "system@liventcord.com",
                    "System",
                    "0000",
                    Utils.CreateRandomUserId(),
                    _passwordHasher
                );
                _context.Users.Add(systemUser);
                await _context.SaveChangesAsync();
            }
        }





    }
}
