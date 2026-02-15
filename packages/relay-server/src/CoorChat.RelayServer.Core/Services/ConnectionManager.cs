using System.Collections.Concurrent;
using CoorChat.RelayServer.Core.Models;
using Microsoft.Extensions.Logging;

namespace CoorChat.RelayServer.Core.Services
{
    /// <summary>
    /// Thread-safe connection manager
    /// </summary>
    public class ConnectionManager : IConnectionManager
    {
        private readonly ConcurrentDictionary<string, AgentConnection> _connections = new();
        private readonly ILogger<ConnectionManager> _logger;

        public ConnectionManager(ILogger<ConnectionManager> logger)
        {
            _logger = logger;
        }

        public Task AddConnectionAsync(string connectionId, string agentId, string role, Dictionary<string, object>? metadata = null)
        {
            var connection = new AgentConnection
            {
                ConnectionId = connectionId,
                AgentId = agentId,
                Role = role,
                ConnectedAt = DateTime.UtcNow,
                LastActivity = DateTime.UtcNow,
                Metadata = metadata ?? new Dictionary<string, object>()
            };

            _connections.TryAdd(connectionId, connection);

            _logger.LogInformation(
                "Agent connected: {AgentId} ({Role}) - ConnectionId: {ConnectionId}",
                agentId, role, connectionId);

            return Task.CompletedTask;
        }

        public Task RemoveConnectionAsync(string connectionId)
        {
            if (_connections.TryRemove(connectionId, out var connection))
            {
                _logger.LogInformation(
                    "Agent disconnected: {AgentId} ({Role}) - ConnectionId: {ConnectionId}",
                    connection.AgentId, connection.Role, connectionId);
            }

            return Task.CompletedTask;
        }

        public AgentConnection? GetConnection(string connectionId)
        {
            _connections.TryGetValue(connectionId, out var connection);
            return connection;
        }

        public IEnumerable<AgentConnection> GetAgentConnections(string agentId)
        {
            return _connections.Values.Where(c => c.AgentId == agentId);
        }

        public IEnumerable<AgentConnection> GetAllConnections()
        {
            return _connections.Values;
        }

        public Task UpdateActivityAsync(string connectionId)
        {
            if (_connections.TryGetValue(connectionId, out var connection))
            {
                connection.LastActivity = DateTime.UtcNow;
            }

            return Task.CompletedTask;
        }

        public bool IsAgentConnected(string agentId)
        {
            return _connections.Values.Any(c => c.AgentId == agentId);
        }

        public int GetConnectionCount()
        {
            return _connections.Count;
        }
    }
}
