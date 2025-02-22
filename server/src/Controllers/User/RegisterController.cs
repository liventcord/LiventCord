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

        public RegisterController(AppDbContext context, NickDiscriminatorController nickDiscriminatorController)
        {
            _context = context;
            _nickDiscriminatorController = nickDiscriminatorController;
            _passwordHasher = new PasswordHasher<User>();
        }

        [HttpPost("register")]
        public IActionResult RegisterAuth([FromForm] RegisterRequest request)
        {
            if (!ModelState.IsValid || _context.Users.Any(u => u.Email.ToLower() == request.Email.ToLower()))
                return BadRequest(ModelState);

            Task.Run(async () =>
            {
                var discriminator = await _nickDiscriminatorController.GetOrCreateDiscriminator(request.Nickname);
                if (discriminator == null)
                    return;

                var userId = Utils.CreateRandomUserId();
                var user = Models.User.Create(userId, request.Email, request.Nickname, discriminator, request.Password, _passwordHasher);

                await _context.Users.AddAsync(user);
                await _context.SaveChangesAsync();
            });

            return Ok();
        }




    }
}
