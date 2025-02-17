public class BuilderService
{
    public static void StartFrontendBuild()
    {
        try
        {
            string workingDirectory = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "web");

            if (!IsNpmInstallRequired(workingDirectory))
            {
                Console.WriteLine("Dependencies are already installed. Skipping npm install.");
            }
            else
            {
                Console.WriteLine("Running npm install...");
                RunCommand("npm", "install", workingDirectory);
            }

            RunCommand("npm", "run build", workingDirectory);

            string sourcePath = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "web", "src", "output");
            string destinationPath = Path.Combine("wwwroot", "app");
            CopyDirectoryContents(sourcePath, destinationPath);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error running frontend build: {ex.Message}");
        }
    }

    private static bool IsNpmInstallRequired(string workingDirectory)
    {
        string nodeModulesPath = Path.Combine(workingDirectory, "node_modules");

        if (!Directory.Exists(nodeModulesPath))
        {
            return true;
        }

        return false;
    }


    private static void RunCommand(string command, string arguments, string workingDirectory)
    {
        var processStartInfo = new System.Diagnostics.ProcessStartInfo
        {
            FileName = command,
            Arguments = arguments,
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using (var process = System.Diagnostics.Process.Start(processStartInfo))
        {
            if (process != null)
            {
                using (var reader = process.StandardOutput)
                {
                    Console.WriteLine(reader.ReadToEnd());
                }
                using (var reader = process.StandardError)
                {
                    Console.WriteLine(reader.ReadToEnd());
                }
                process.WaitForExit();
            }
        }
    }

    private static void CopyDirectoryContents(string sourcePath, string destinationPath)
    {
        try
        {
            if (Directory.Exists(sourcePath))
            {
                Directory.CreateDirectory(destinationPath);

                foreach (var file in Directory.GetFiles(sourcePath))
                {
                    var destFile = Path.Combine(destinationPath, Path.GetFileName(file));
                    File.Copy(file, destFile, true);
                }

                foreach (var directory in Directory.GetDirectories(sourcePath))
                {
                    var destDir = Path.Combine(destinationPath, Path.GetFileName(directory));
                    CopyDirectoryContents(directory, destDir);
                }

            }
            else
            {
                Console.WriteLine("Source path does not exist.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error copying contents: {ex.Message}");
        }
    }
}
