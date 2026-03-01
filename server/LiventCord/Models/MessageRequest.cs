using System.ComponentModel.DataAnnotations;
using LiventCord.Models;
using Microsoft.AspNetCore.Mvc;

public class NewBotMessageRequest
{
    [IdLengthValidation]
    public required string MessageId { get; set; }
    public required string UserId { get; set; }
    public string? Content { get; set; }

    private DateTime _date;
    public required DateTime Date
    {
        get => _date;
        set => _date = DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }

    private DateTime? _lastEdited;
    public DateTime? LastEdited
    {
        get => _lastEdited;
        set =>
            _lastEdited = value.HasValue
                ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
                : null;
    }

    public string? AttachmentUrls { get; set; }
    public string? ReplyToId { get; set; }
    public string? ReactionEmojisIds { get; set; }
    public List<Embed>? Embeds { get; set; } = new List<Embed>();
}

public class NewMessageRequest : IValidatableObject
{
    [BindProperty(Name = "content")]
    [StringLength(2000, ErrorMessage = "Content must not exceed 2000 characters.")]
    public string? Content { get; set; }

    [BindProperty(Name = "attachments")]
    public List<PendingAttachmentRef>? Attachments { get; set; }

    [BindProperty(Name = "replyToId")]
    public string? ReplyToId { get; set; }

    [BindProperty(Name = "temporaryId")]
    public string? TemporaryId { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        bool hasAttachments = Attachments != null && Attachments.Any();
        bool hasContent = !string.IsNullOrWhiteSpace(Content);

        if (!hasContent && !hasAttachments)
        {
            yield return new ValidationResult(
                "Either content or at least one attachment must be provided.",
                new[] { nameof(Content), nameof(Attachments) }
            );
        }
    }
}


public class EditMessageRequest
{
    [Required]
    [StringLength(2000, ErrorMessage = "Content must not exceed 2000 characters.")]
    public required string Content { get; set; }
}

public enum MessageType
{
    Guilds,
    Dms,
}

public class SearchRequest
{
    public string? channelId { get; set; }
    public string? Query { get; set; }
    public string? FromUserId { get; set; }
    public string? MentioningUserId { get; set; }
    public string? BeforeDate { get; set; }
    public string? DuringDate { get; set; }
    public string? AfterDate { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 50;
    public bool isOldMessages { get; set; } = false;
}

public class SearchMessagesResponse
{
    public int TotalCount { get; set; }
    public List<Message> Messages { get; set; } = new List<Message>();
}
