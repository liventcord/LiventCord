public abstract class FileBase
{
    public string? FileName { get; set; }
    public required string FileId { get; set; }
    public string? GuildId { get; set; }
    public required byte[] Content { get; set; }
    public required string Extension { get; set; }

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
}

public class AttachmentFile : FileBase
{
    public required string ChannelId { get; set; }
    public required string UserId { get; set; }
    public required string MessageId { get; set; }

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
}

public class GuildFile : FileBase
{
    public required string ChannelId { get; set; }
    public required string UserId { get; set; }

    public GuildFile(
        string fileId,
        string fileName,
        byte[] content,
        string extension,
        string channelId,
        string userId,
        string? guildId
    )
        : base(fileId, fileName, content, extension, guildId)
    {
        ChannelId = channelId;
        UserId = userId;
    }
}

public class ProfileFile : FileBase
{
    public required string UserId { get; set; }

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
}
