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
        if (userId == friendId)
            return false;

        var usersExist = await _dbContext.Users
            .Where(u => u.UserId == userId || u.UserId == friendId)
            .CountAsync() == 2;

        if (!usersExist)
            return false;

        var exists = await _dbContext.UserDms
            .AnyAsync(d => d.UserId == userId && d.FriendId == friendId);

        if (exists)
            return false;

        _dbContext.UserDms.Add(new UserDm
        {
            UserId = userId,
            FriendId = friendId
        });

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
        var userDetails = await _dbContext
            .Users.Where(user => user.UserId == friendId)
            .Select(user => user.GetPublicUser())
            .FirstOrDefaultAsync();

        return userDetails;
    }
}
