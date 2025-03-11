using Microsoft.EntityFrameworkCore;

[Owned]
public class Embed
{
    public string? Id { get; set; }
    public string? Title { get; set; }
    public EmbedType? Type { get; set; } = EmbedType.Rich;
    public string? Description { get; set; }
    public string? Url { get; set; }
    public int? Color { get; set; } = 0x808080;
    public List<EmbedField> Fields { get; set; } = new();
    public EmbedThumbnail? Thumbnail { get; set; }
    public EmbedVideo? Video { get; set; }
    public EmbedAuthor? Author { get; set; }
    public EmbedImage? Image { get; set; }
    public EmbedFooter? Footer { get; set; }
}



public class EmbedThumbnail
{
    public required string Url { get; set; }
    public string? ProxyUrl { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
}

public class EmbedImage
{
    public required string Url { get; set; }
    public string? ProxyUrl { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
}

public enum EmbedType
{
    Article,
    GIFV,
    Image,
    Link,
    PollResult,
    Rich,
    Video
}
public class EmbedFooter
{
    public required string Text { get; set; }
    public string? IconUrl { get; set; }
}
public class EmbedAuthor
{
    public required string Name { get; set; }
    public string? Url { get; set; }
    public string? IconUrl { get; set; }
}
public class EmbedVideo
{
    public required string Url { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string? ProxyUrl { get; set; }

}
public class EmbedField
{
    public required string Name { get; set; }
    public required string Value { get; set; }
}
