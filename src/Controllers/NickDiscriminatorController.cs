using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace LiventCord.Controllers
{
    [Route("api")]
    [ApiController]
    public class NickDiscriminatorController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;

        public NickDiscriminatorController(AppDbContext context, IMemoryCache cache)
        {
            _context = context;
            _cache = cache;
        }

        [Authorize]
        [HttpPut("nicks")]
        public async Task<IActionResult> ChangeNickname([FromBody] ChangeNicknameRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var user = await _context.Users.FindAsync(UserId);
            if (user == null)
            {
                return NotFound("User not found");
            }
            user.Nickname = request.NewNickname;

            await _context.SaveChangesAsync();

            return Ok("Nickname updated successfully");
        }

        [HttpGet("discriminators")]
        public async Task<IActionResult> GetNickDiscriminator([FromQuery] string nick)
        {
            if (string.IsNullOrWhiteSpace(nick))
                return BadRequest(new { error = "Invalid parameters" });

            bool isUnique = !await _context.Users.AnyAsync(u =>
                u.Nickname.ToLower() == nick.ToLower()
            );
            string? result = isUnique ? "0000" : null;

            return Ok(new { result, nick });
        }

        [NonAction]
        public async Task<string?> GetOrCreateDiscriminator(string nickName)
        {
            var existingDiscriminators = await _context
                .Users.Where(u => u.Nickname.ToLower() == nickName.ToLower())
                .Select(u => u.Discriminator)
                .ToListAsync();

            if (
                _cache.TryGetValue(
                    "reserved_discriminators",
                    out Dictionary<string, string>? reservedDiscriminators
                )
            )
            {
                if (reservedDiscriminators != null && reservedDiscriminators.ContainsKey(nickName))
                {
                    existingDiscriminators.Add(reservedDiscriminators[nickName]);
                }
            }

            if (!existingDiscriminators.Contains("0000"))
            {
                return "0000";
            }

            return existingDiscriminators.Count < 9999
                ? SelectDiscriminator(existingDiscriminators)
                : null;
        }

        private string SelectDiscriminator(IEnumerable<string> existing)
        {
            var set = new HashSet<string>(existing);
            var random = new Random();
            return Enumerable
                    .Range(0, 10000)
                    .Select(_ => random.Next(0, 10000).ToString("D4"))
                    .FirstOrDefault(d => !set.Contains(d)) ?? throw new InvalidOperationException();
        }
    }
}
