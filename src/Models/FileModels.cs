public abstract class FileBase
{
    public string? FileName { get; set; }
    public string FileId { get; set; }
    public string? GuildId { get; set; }
    public byte[] Content { get; set; }
    public string Extension { get; set; }

    protected FileBase(
        string fileId,
        string fileName,
        byte[] content,
        string extension,
        string? guildId = null
    )
    {
        FileId = fileId;
        FileName = fileName;
        Content = content;
        Extension = extension;
        GuildId = guildId;
    }

    public abstract bool Matches(string? userId, string? guildId);
}

public class AttachmentFile : FileBase
{
    public string ChannelId { get; set; }
    public string UserId { get; set; }
    public string MessageId { get; set; }

    public AttachmentFile(
        string fileId,
        string fileName,
        byte[] content,
        string extension,
        string channelId,
        string userId,
        string messageId
    )
        : base(fileId, fileName, content, extension)
    {
        ChannelId = channelId;
        UserId = userId;
        MessageId = messageId;
    }

    public override bool Matches(string? userId, string? guildId) =>
        UserId == userId && GuildId == guildId;
}

public class EmojiFile : FileBase
{
    public EmojiFile(
        string fileId,
        string fileName,
        byte[] content,
        string extension,
        string? guildId
    )
        : base(fileId, fileName, content, extension, guildId) { }

    public override bool Matches(string? userId, string? guildId) => GuildId == guildId;
}

public class GuildFile : FileBase
{
    public string UserId { get; set; }

    public GuildFile(
        string fileId,
        string fileName,
        byte[] content,
        string extension,
        string? guildId,
        string userId
    )
        : base(fileId, fileName, content, extension, guildId)
    {
        UserId = userId;
    }

    public override bool Matches(string? userId, string? guildId) =>
        UserId == userId && GuildId == guildId;
}

public class ProfileFile : FileBase
{
    public string UserId { get; set; }

    public ProfileFile(
        string fileId,
        string fileName,
        byte[] content,
        string extension,
        string userId
    )
        : base(fileId, fileName, content, extension)
    {
        UserId = userId;
    }

    public override bool Matches(string? userId, string? guildId) => UserId == userId;
}
