using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using LiventCord.Data;
using Microsoft.EntityFrameworkCore;

namespace LiventCord.Controllers
{
    [Route("api")]
    [ApiController]
    public class NickDiscriminatorController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;

        public NickDiscriminatorController(AppDbContext context, IMemoryCache cache)
        {
            _context = context;
            _cache = cache;
        }

        [HttpGet("discriminators")]
        public async Task<IActionResult> GetNickDiscriminator([FromQuery] string nick)
        {
            if (string.IsNullOrWhiteSpace(nick))
                return BadRequest(new { error = "Invalid parameters" });

            bool isUnique = !await _context.Users.AnyAsync(u => u.Nickname.ToLower() == nick.ToLower());

            if (!_cache.TryGetValue("reserved_discriminators", out Dictionary<string, string>? reservedDiscriminators) || reservedDiscriminators == null)
            {
                reservedDiscriminators = new Dictionary<string, string>();
            }

            if (!reservedDiscriminators.ContainsKey(nick))
            {
                string? discriminator = isUnique ? "0000" : await GetOrCreateDiscriminator(nick);
                if(discriminator != null) {
                    reservedDiscriminators[nick] = discriminator;

                }

                _cache.Set("reserved_discriminators", reservedDiscriminators, TimeSpan.FromMinutes(10));
            }

            string result = reservedDiscriminators[nick];
            return Ok(new { result, nick });
        }

        [NonAction]
        public async Task<string?> GetOrCreateDiscriminator(string nickname)
        {
            var existingDiscriminators = await _context.Users
                .Where(u => u.Nickname.ToLower() == nickname.ToLower())
                .Select(u => u.Discriminator)
                .ToListAsync();

            if (_cache.TryGetValue("reserved_discriminators", out Dictionary<string, string>? reservedDiscriminators))
            {
                if (reservedDiscriminators != null && reservedDiscriminators.ContainsKey(nickname))
                {
                    existingDiscriminators.Add(reservedDiscriminators[nickname]);
                }
            }

            return existingDiscriminators.Count < 9999 
                ? SelectDiscriminator(existingDiscriminators) 
                : null;
        }



        private string SelectDiscriminator(IEnumerable<string> existing)
        {
            var set = new HashSet<string>(existing);
            var random = new Random();
            return Enumerable.Range(0, 10000)
                .Select(_ => random.Next(0, 10000).ToString("D4"))
                .FirstOrDefault(d => !set.Contains(d)) ?? throw new InvalidOperationException();
        }





        private string CreateDiscriminator(string nick)
        {
            return (nick.GetHashCode() % 10000).ToString("D4");
        }
    }
}
