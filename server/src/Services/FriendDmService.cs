using LiventCord.Controllers;
using LiventCord.Models;
using Microsoft.EntityFrameworkCore;

public class FriendDmService
{
    private readonly AppDbContext _dbContext;

    public FriendDmService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> AddDmBetweenUsers(string userId, string friendId)
    {
        if (userId == friendId) return false;

        var user = await _dbContext.Users.FindAsync(userId);
        var friend = await _dbContext.Users.FindAsync(friendId);

        if (user == null || friend == null)
        {
            return false;
        }

        var existingDm1 = await _dbContext.UserDms
            .FirstOrDefaultAsync(d => d.UserId == userId && d.FriendId == friendId);
        var existingDm2 = await _dbContext.UserDms
            .FirstOrDefaultAsync(d => d.UserId == friendId && d.FriendId == userId);

        if (existingDm1 != null || existingDm2 != null)
        {
            return false;
        }

        _dbContext.UserDms.AddRange(
            new UserDm { UserId = userId, FriendId = friendId },
            new UserDm { UserId = friendId, FriendId = userId }
        );

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<List<PublicUser>> GetDmUsers(string userId)
    {
        return await _dbContext
            .UserDms.Where(d => d.UserId == userId)
            .Join(
                _dbContext.Users,
                friend => friend.FriendId,
                user => user.UserId,
                (friend, user) => user.GetPublicUser()
            )
            .ToListAsync();
    }
    public async Task<PublicUser?> GetUserDetails(string friendId)
    {
        var userDetails = await _dbContext.Users
            .Where(user => user.UserId == friendId)
            .Select(user => user.GetPublicUser())
            .FirstOrDefaultAsync();

        return userDetails;
    }




}
