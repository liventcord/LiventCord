public abstract class FileBase
{
    public string? FileName { get; set; }
    public string FileId { get; set; }
    public string? GuildId { get; set; }
    public byte[] Content { get; set; }
    public string Extension { get; set; }
    public string FileType { get; set; }
    public int ContentLength { get; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? ContentHash { get; set; }

    protected FileBase(
        string fileId,
        string fileName,
        byte[] content,
        string extension,
        string fileType,
        string? guildId = null
    )
    {
        FileId = fileId;
        FileName = fileName;
        Content = content;
        ContentLength = content.Length;
        Extension = extension;
        FileType = fileType;
        GuildId = guildId;
    }

    public abstract bool Matches(string? userId, string? guildId);
}

public class AttachmentFile : FileBase
{
    public string ChannelId { get; set; }
    public string UserId { get; set; }

    public AttachmentFile(
        string fileId,
        string fileName,
        byte[] content,
        string extension,
        string channelId,
        string? guildId,
        string userId
    )
        : base(fileId, fileName, content, extension, "attachments", guildId)
    {
        ChannelId = channelId;
        UserId = userId;
    }

    public override bool Matches(string? userId, string? guildId) =>
        UserId == userId && GuildId == guildId && FileId == FileId;
}

public class EmojiFile : FileBase
{
    public string UserId { get; set; }

    public EmojiFile(
        string fileId,
        string fileName,
        byte[] content,
        string extension,
        string guildId,
        string userId
    )
        : base(fileId, fileName, content, extension, "emoji", guildId)
    {
        UserId = userId;
    }

    public override bool Matches(string? userId, string? guildId) =>
        UserId == userId && GuildId == guildId;
}

public class GuildFile : FileBase
{
    public string UserId { get; set; }
    public string Version { get; set; } = Guid.NewGuid().ToString();

    public GuildFile(
        string fileId,
        string fileName,
        byte[] content,
        string extension,
        string? guildId,
        string userId
    )
        : base(fileId, fileName, content, extension, "guild", guildId)
    {
        UserId = userId;
    }

    public override bool Matches(string? userId, string? guildId) =>
        UserId == userId && GuildId == guildId;
}

public class ProfileFile : FileBase
{
    public string UserId { get; set; }
    public string Version { get; set; } = Guid.NewGuid().ToString();

    public ProfileFile(
        string fileId,
        string fileName,
        byte[] content,
        string extension,
        string userId
    )
        : base(fileId, fileName, content, "profile", extension)
    {
        UserId = userId;
    }

    public override bool Matches(string? userId, string? guildId) => UserId == userId;
}
