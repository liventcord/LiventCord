using LiventCord.Helpers;
using LiventCord.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("auth")]
    [ApiController]
    public class RegisterController : BaseController
    {
        private readonly AppDbContext _context;

        private readonly NickDiscriminatorController _nickDiscriminatorController;

        public RegisterController(
            AppDbContext context,
            NickDiscriminatorController nickDiscriminatorController
        )
        {
            _context = context;
            _nickDiscriminatorController = nickDiscriminatorController;
        }

        [HttpPost("register")]
        public async Task<IActionResult> RegisterAuth([FromForm] RegisterRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (await _context.Users.AnyAsync(u => u.Email.ToLower() == request.Email.ToLower()))
                return Conflict();

            var discriminator = await _nickDiscriminatorController.GetOrCreateDiscriminator(
                request.Nickname
            );
            if (discriminator == null)
                return BadRequest(new { error = "No available discriminators." });

            await _context.Users.AddAsync(
                new User
                {
                    UserId = Utils.CreateRandomId(),
                    Email = request.Email,
                    Password = BCrypt.Net.BCrypt.HashPassword(request.Password),
                    Nickname = request.Nickname,
                    Discriminator = discriminator,
                    Bot = 0,
                    Status = "offline",
                }
            );
            await _context.SaveChangesAsync();

            return Ok();
        }
    }
}
