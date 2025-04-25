using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;

namespace LiventCord.Controllers
{
    [Route("auth")]
    [ApiController]
    public class RegisterController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly NickDiscriminatorController _nickDiscriminatorController;
        private readonly PasswordHasher<User> _passwordHasher;
        private readonly IConfiguration _configuration;

        public RegisterController(
            AppDbContext context,
            NickDiscriminatorController nickDiscriminatorController,
            IConfiguration configuration)
        {
            _context = context;
            _nickDiscriminatorController = nickDiscriminatorController;
            _passwordHasher = new PasswordHasher<User>();
            _configuration = configuration;
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
    }
}