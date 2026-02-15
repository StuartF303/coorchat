using CoorChat.RelayServer.Core.Models;

namespace CoorChat.RelayServer.Core.Services
{
    /// <summary>
    /// Manages agent connections
    /// </summary>
    public interface IConnectionManager
    {
        /// <summary>
        /// Register a new agent connection
        /// </summary>
        Task AddConnectionAsync(string connectionId, string agentId, string role, Dictionary<string, object>? metadata = null);

        /// <summary>
        /// Remove an agent connection
        /// </summary>
        Task RemoveConnectionAsync(string connectionId);

        /// <summary>
        /// Get connection by connection ID
        /// </summary>
        AgentConnection? GetConnection(string connectionId);

        /// <summary>
        /// Get all connections for an agent
        /// </summary>
        IEnumerable<AgentConnection> GetAgentConnections(string agentId);

        /// <summary>
        /// Get all active connections
        /// </summary>
        IEnumerable<AgentConnection> GetAllConnections();

        /// <summary>
        /// Update last activity timestamp
        /// </summary>
        Task UpdateActivityAsync(string connectionId);

        /// <summary>
        /// Check if agent is connected
        /// </summary>
        bool IsAgentConnected(string agentId);

        /// <summary>
        /// Get total connection count
        /// </summary>
        int GetConnectionCount();
    }
}
