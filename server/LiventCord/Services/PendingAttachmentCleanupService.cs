using LiventCord.Controllers;
using Microsoft.EntityFrameworkCore;

public class PendingAttachmentCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PendingAttachmentCleanupService> _logger;
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan ExpiryThreshold = TimeSpan.FromHours(1);

    public PendingAttachmentCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<PendingAttachmentCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(CleanupInterval, stoppingToken);
            await CleanupExpiredAttachments(stoppingToken);
        }
    }

    private async Task CleanupExpiredAttachments(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var expiryCutoff = DateTime.UtcNow - ExpiryThreshold;

            var expired = await context.PendingAttachments
                .Where(p => !p.Claimed && p.CreatedAt < expiryCutoff)
                .ToListAsync(stoppingToken);

            if (!expired.Any()) return;

            var expiredFileIds = expired.Select(p => p.FileId).ToList();

            var attachmentFiles = await context.Set<AttachmentFile>()
                .Where(f => expiredFileIds.Contains(f.FileId))
                .ToListAsync(stoppingToken);

            context.Set<AttachmentFile>().RemoveRange(attachmentFiles);
            context.PendingAttachments.RemoveRange(expired);

            await context.SaveChangesAsync(stoppingToken);

            _logger.LogInformation(
                "Cleaned up {Count} expired pending attachments.", expired.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during pending attachment cleanup.");
        }
    }
}