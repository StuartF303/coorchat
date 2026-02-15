namespace CoorChat.RelayServer.Core.Models
{
    /// <summary>
    /// Represents a connected agent
    /// </summary>
    public class AgentConnection
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string AgentId { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;
        public DateTime LastActivity { get; set; } = DateTime.UtcNow;
        public Dictionary<string, object> Metadata { get; set; } = new();
    }
}
