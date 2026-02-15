using Microsoft.AspNetCore.SignalR;
using CoorChat.RelayServer.Core.Models;
using CoorChat.RelayServer.Core.Services;

namespace CoorChat.RelayServer.Api.Hubs
{
    /// <summary>
    /// SignalR Hub for agent coordination
    /// </summary>
    public class AgentHub : Hub
    {
        private readonly IConnectionManager _connectionManager;
        private readonly ILogger<AgentHub> _logger;

        public AgentHub(
            IConnectionManager connectionManager,
            ILogger<AgentHub> logger)
        {
            _connectionManager = connectionManager;
            _logger = logger;
        }

        /// <summary>
        /// Register agent connection
        /// </summary>
        public async Task RegisterAgent(string agentId, string role, Dictionary<string, object>? metadata = null)
        {
            await _connectionManager.AddConnectionAsync(
                Context.ConnectionId,
                agentId,
                role,
                metadata);

            // Notify other agents
            await Clients.Others.SendAsync("AgentConnected", new
            {
                agentId,
                role,
                timestamp = DateTime.UtcNow
            });

            _logger.LogInformation(
                "Agent registered: {AgentId} ({Role})",
                agentId, role);
        }

        /// <summary>
        /// Send message to all agents (broadcast)
        /// </summary>
        public async Task SendMessage(AgentMessage message)
        {
            await _connectionManager.UpdateActivityAsync(Context.ConnectionId);

            _logger.LogDebug(
                "Broadcasting message: {MessageType} from {SenderId}",
                message.MessageType, message.SenderId);

            // Broadcast to all except sender
            await Clients.Others.SendAsync("ReceiveMessage", message);
        }

        /// <summary>
        /// Send message to specific agent (unicast)
        /// </summary>
        public async Task SendMessageToAgent(string recipientId, AgentMessage message)
        {
            await _connectionManager.UpdateActivityAsync(Context.ConnectionId);

            var recipientConnections = _connectionManager
                .GetAgentConnections(recipientId)
                .Select(c => c.ConnectionId)
                .ToList();

            if (recipientConnections.Any())
            {
                _logger.LogDebug(
                    "Sending message: {MessageType} from {SenderId} to {RecipientId}",
                    message.MessageType, message.SenderId, recipientId);

                await Clients.Clients(recipientConnections).SendAsync("ReceiveMessage", message);
            }
            else
            {
                _logger.LogWarning(
                    "Recipient not found: {RecipientId}",
                    recipientId);

                // Send error back to sender
                await Clients.Caller.SendAsync("MessageError", new
                {
                    error = "RecipientNotFound",
                    message = $"Agent {recipientId} is not connected",
                    originalMessage = message
                });
            }
        }

        /// <summary>
        /// Heartbeat to keep connection alive
        /// </summary>
        public async Task Heartbeat()
        {
            await _connectionManager.UpdateActivityAsync(Context.ConnectionId);

            var connection = _connectionManager.GetConnection(Context.ConnectionId);
            if (connection != null)
            {
                await Clients.Caller.SendAsync("HeartbeatAck", new
                {
                    timestamp = DateTime.UtcNow,
                    agentId = connection.AgentId
                });
            }
        }

        /// <summary>
        /// Get list of connected agents
        /// </summary>
        public async Task GetConnectedAgents()
        {
            var agents = _connectionManager.GetAllConnections()
                .Select(c => new
                {
                    c.AgentId,
                    c.Role,
                    c.ConnectedAt,
                    c.LastActivity
                })
                .ToList();

            await Clients.Caller.SendAsync("ConnectedAgents", agents);
        }

        /// <summary>
        /// Query agent status
        /// </summary>
        public async Task QueryStatus(string agentId)
        {
            var isConnected = _connectionManager.IsAgentConnected(agentId);
            var connections = _connectionManager.GetAgentConnections(agentId).ToList();

            await Clients.Caller.SendAsync("AgentStatus", new
            {
                agentId,
                isConnected,
                connectionCount = connections.Count,
                connections = connections.Select(c => new
                {
                    c.ConnectionId,
                    c.ConnectedAt,
                    c.LastActivity
                })
            });
        }

        /// <summary>
        /// Called when agent connects
        /// </summary>
        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation(
                "Client connected: {ConnectionId}",
                Context.ConnectionId);

            await base.OnConnectedAsync();
        }

        /// <summary>
        /// Called when agent disconnects
        /// </summary>
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var connection = _connectionManager.GetConnection(Context.ConnectionId);

            if (connection != null)
            {
                await _connectionManager.RemoveConnectionAsync(Context.ConnectionId);

                // Notify other agents
                await Clients.Others.SendAsync("AgentDisconnected", new
                {
                    agentId = connection.AgentId,
                    role = connection.Role,
                    timestamp = DateTime.UtcNow
                });

                _logger.LogInformation(
                    "Agent disconnected: {AgentId} ({Role})",
                    connection.AgentId, connection.Role);
            }

            if (exception != null)
            {
                _logger.LogError(
                    exception,
                    "Client disconnected with error: {ConnectionId}",
                    Context.ConnectionId);
            }

            await base.OnDisconnectedAsync(exception);
        }
    }
}
