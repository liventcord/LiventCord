using Microsoft.AspNetCore.Mvc;
using LiventCord.Data;
using LiventCord.Models;
using Microsoft.EntityFrameworkCore;
using LiventCord.Helpers;
using System.ComponentModel.DataAnnotations;

namespace LiventCord.Controllers
{
    [Route("auth")]
    [ApiController]
    public class RegisterController : ControllerBase
    {
        private readonly AppDbContext _context;

        private readonly NickDiscriminatorController _nickDiscriminatorController;
        public RegisterController(AppDbContext context, NickDiscriminatorController nickDiscriminatorController)
        {
            _context = context;
            _nickDiscriminatorController = nickDiscriminatorController;
        }


        [HttpPost("register")]
        public async Task<IActionResult> RegisterAuth([FromForm] RegisterRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (await _context.Users.AnyAsync(u => u.Email.ToLower() == request.Email.ToLower()))
                return Conflict(new { error = "Email already exists." });

            var discriminator = await _nickDiscriminatorController.GetOrCreateDiscriminator(request.Nickname);
            if (discriminator == null)
                return BadRequest(new { error = "No available discriminators." });

            await _context.Users.AddAsync(new User
            {
                UserId = Utils.CreateRandomId(),
                Email = request.Email,
                Password = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Nickname = request.Nickname,
                Discriminator = discriminator,
                Bot = 0,
                Status = "offline"
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Registration successful." });
        }


    }
}
