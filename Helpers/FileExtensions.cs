namespace LiventCord.Helpers
{
    public static class FileExtensions
    {
        public static readonly string[] AllowedExtensions =
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".bmp",
            ".webp",
            ".tiff",
            ".tif",
            ".svg",
            ".heif",
            ".heic",
            ".jfif",
            ".indd",
            ".raw",
            ".dng",
            ".ico",
            ".exif",
            ".ai",
            ".eps",
            ".pdn",
            ".pbm",
            ".pgm",
            ".ppm",
            ".pbm",
            ".pnm",
            ".cut",
            ".cur",
            ".xpm",
            ".avif",
            ".apng",
            ".jpe",
            ".jif",
        };

        public static bool IsValidImageExtension(string extension)
        {
            return AllowedExtensions.Contains(extension.ToLower());
        }

        public static bool HasImageExtension(string fileId)
        {
            return AllowedExtensions.Any(ext =>
                fileId.EndsWith(ext, StringComparison.OrdinalIgnoreCase)
            );
        }
    }
}
