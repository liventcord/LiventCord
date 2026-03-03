using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace LiventCord.Controllers
{
    [Route("api/v1")]
    [ApiController]
    public class NickDiscriminatorController : BaseController
    {
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;
        private static readonly SemaphoreSlim _nickLock = new(1, 1);

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

            if (_cache.TryGetValue(nick, out string? cachedDiscriminator))
                return Ok(new { discriminator = cachedDiscriminator });

            var discriminator = await GetOrCreateDiscriminator(nick);
            if (discriminator == null)
                return BadRequest(new { error = "No available discriminators" });

            _cache.Set(nick, discriminator, TimeSpan.FromSeconds(60));
            return Ok(new { discriminator });
        }

        [NonAction]
        public async Task<string?> GetCachedOrNewDiscriminator(string nickName)
        {
            if (_cache.TryGetValue(nickName, out string? cachedDiscriminator))
            {
                _cache.Remove(nickName);
                return cachedDiscriminator;
            }
            return await GetOrCreateDiscriminator(nickName);
        }

        [NonAction]
        public async Task<string?> GetOrCreateDiscriminator(string nickName)
        {
            bool zeroTaken = await _context.Users
                .AnyAsync(u => u.Nickname == nickName && u.Discriminator == "0000");

            if (!zeroTaken)
                return "0000";

            int count = await _context.Users.CountAsync(u => u.Nickname == nickName);
            if (count >= 9999)
                return null;

            var taken = await _context.Users
                .Where(u => u.Nickname == nickName)
                .Select(u => u.Discriminator)
                .ToListAsync();

            return SelectDiscriminator(taken);
        }

        [Authorize]
        [HttpPatch("nicks")]
        public async Task<IActionResult> ChangeNickname([FromBody] ChangeNicknameRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var user = await _context.Users.FindAsync(UserId);
            if (user == null)
                return NotFound("User not found");

            await _nickLock.WaitAsync();
            try
            {
                var newDiscriminator = await GetOrCreateDiscriminator(request.NewNickname);
                if (newDiscriminator == null)
                    return BadRequest(new { error = "No available discriminators for this nickname" });

                user.Nickname = request.NewNickname;
                user.Discriminator = newDiscriminator;

                await _context.SaveChangesAsync();
            }
            finally
            {
                _nickLock.Release();
            }

            return Ok();
        }

        private string SelectDiscriminator(IEnumerable<string> existing)
        {
            var taken = new HashSet<string>(existing) { "0000" };
            var available = Enumerable.Range(1, 9999)
                .Select(i => i.ToString("D4"))
                .Where(d => !taken.Contains(d))
                .ToList();

            if (available.Count == 0)
                throw new InvalidOperationException("Discriminator namespace exhausted");

            return available[Random.Shared.Next(available.Count)];
        }
    }
}