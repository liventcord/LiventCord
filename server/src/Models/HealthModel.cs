public class ServiceData
{
    public string? Service { get; set; }
    public string? Status { get; set; }
    public string? Uptime { get; set; }
    public int? ServedFilesSinceStartup { get; set; }

    public MemoryInfo? Memory { get; set; }
    public double? CpuUsagePercent { get; set; }
    public int? CpuCores { get; set; }

    public double usedDbSize { get; set; }
}

public class MemoryInfo
{
    public SystemMemory? System { get; set; }
    public string? OS { get; set; }
    public int? NumGc { get; set; }
}

public class SystemMemory
{
    public double? UsedPercent { get; set; }
    public string? Used { get; set; }
    public string? Total { get; set; }
}
