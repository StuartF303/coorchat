using System.Text.Json.Serialization;

namespace CoorChat.RelayServer.Core.Models
{
    /// <summary>
    /// Message exchanged between agents
    /// </summary>
    public class AgentMessage
    {
        [JsonPropertyName("protocolVersion")]
        public string ProtocolVersion { get; set; } = "1.0.0";

        [JsonPropertyName("messageType")]
        public string MessageType { get; set; } = string.Empty;

        [JsonPropertyName("senderId")]
        public string SenderId { get; set; } = string.Empty;

        [JsonPropertyName("recipientId")]
        public string? RecipientId { get; set; }

        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; } = DateTime.UtcNow.ToString("o");

        [JsonPropertyName("correlationId")]
        public string? CorrelationId { get; set; }

        [JsonPropertyName("priority")]
        public string Priority { get; set; } = "medium";

        [JsonPropertyName("payload")]
        public object? Payload { get; set; }

        [JsonPropertyName("metadata")]
        public Dictionary<string, object>? Metadata { get; set; }
    }
}
