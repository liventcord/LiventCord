using LiventCord.Controllers;
using LiventCord.Models;
using Microsoft.EntityFrameworkCore;

public class AttachmentDeduplicationService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IAppLogger<AttachmentDeduplicationService> _logger;

    public AttachmentDeduplicationService(
        IServiceScopeFactory scopeFactory,
        IAppLogger<AttachmentDeduplicationService> logger
    )
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task DeduplicateAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        try
        {
            var attachments = await context.Attachments.AsNoTracking().ToListAsync(stoppingToken);

            var duplicateGroups = attachments
                .GroupBy(a => new
                {
                    a.MessageId,
                    a.FileName,
                    a.FileSize,
                    a.ProxyUrl,
                })
                .Where(g => g.Count() > 1);

            var attachmentsToRemove = new List<Attachment>();

            foreach (var group in duplicateGroups)
            {
                attachmentsToRemove.AddRange(group.Skip(1));
            }

            if (attachmentsToRemove.Count > 0)
            {
                _logger.LogInformation(
                    "Found {Count} duplicate attachments. Removing...",
                    attachmentsToRemove.Count
                );

                context.AttachRange(attachmentsToRemove);
                context.Attachments.RemoveRange(attachmentsToRemove);

                await context.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("Successfully removed duplicates.");
            }
            else
            {
                _logger.LogInformation("No duplicates found.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred during deduplication.");
        }
    }
}
