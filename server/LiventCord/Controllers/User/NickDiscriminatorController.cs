using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("api")]
    [ApiController]
    public class NickDiscriminatorController : BaseController
    {
        private readonly AppDbContext _context;
        private static readonly ConcurrentDictionary<string, string> _discriminatorCache = new();

        public NickDiscriminatorController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("discriminators")]
        public async Task<IActionResult> GetNickDiscriminator([FromQuery] string nick)
        {
            if (string.IsNullOrWhiteSpace(nick))
                return BadRequest(new { error = "Invalid parameters" });

            if (_discriminatorCache.TryGetValue(nick, out var cachedDiscriminator))
            {
                return Ok(new { discriminator = cachedDiscriminator });
            }

            var discriminator = await GetOrCreateDiscriminator(nick);
            if (discriminator == null)
                return BadRequest("No available discriminators");

            _discriminatorCache[nick] = discriminator;
            return Ok(new { discriminator });
        }

        [NonAction]
        public async Task<string?> GetCachedOrNewDiscriminator(string nickName)
        {
            if (_discriminatorCache.TryGetValue(nickName, out var cachedDiscriminator))
            {
                _discriminatorCache.TryRemove(nickName, out _);
                return cachedDiscriminator;
            }
            return await GetOrCreateDiscriminator(nickName);
        }

        [NonAction]
        public async Task<string?> GetOrCreateDiscriminator(string nickName)
        {
            var existingDiscriminators = await _context
                .Users.Where(u => u.Nickname == nickName)
                .Select(u => u.Discriminator)
                .ToListAsync();

            if (!existingDiscriminators.Contains("0000"))
            {
                return "0000";
            }

            if (existingDiscriminators.Count >= 9999)
            {
                return null;
            }

            string newDiscriminator = SelectDiscriminator(existingDiscriminators);
            return newDiscriminator;
        }

        [Authorize]
        [HttpPatch("nicks")]
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
            return Ok();
        }

        private string SelectDiscriminator(IEnumerable<string> existing)
        {
            var set = new HashSet<string>(existing);

            set.Add("0000");

            var random = new Random();
            return Enumerable
                    .Range(0, 10000)
                    .Select(_ => random.Next(0, 10000).ToString("D4"))
                    .FirstOrDefault(d => !set.Contains(d))
                ?? throw new InvalidOperationException();
        }
    }
}
