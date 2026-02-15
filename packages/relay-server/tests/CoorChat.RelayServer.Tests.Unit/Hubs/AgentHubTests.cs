using CoorChat.RelayServer.Api.Hubs;
using CoorChat.RelayServer.Core.Models;
using CoorChat.RelayServer.Core.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace CoorChat.RelayServer.Tests.Unit.Hubs;

public class AgentHubTests
{
    private readonly Mock<IConnectionManager> _connectionManagerMock;
    private readonly Mock<IAuthenticationService> _authServiceMock;
    private readonly Mock<ILogger<AgentHub>> _loggerMock;
    private readonly AgentHub _hub;

    // SignalR mocks
    private readonly Mock<IHubCallerClients> _clientsMock;
    private readonly Mock<ISingleClientProxy> _callerMock;
    private readonly Mock<ISingleClientProxy> _othersMock;
    private readonly Mock<HubCallerContext> _contextMock;

    public AgentHubTests()
    {
        _connectionManagerMock = new Mock<IConnectionManager>();
        _authServiceMock = new Mock<IAuthenticationService>();
        _loggerMock = new Mock<ILogger<AgentHub>>();

        _clientsMock = new Mock<IHubCallerClients>();
        _callerMock = new Mock<ISingleClientProxy>();
        _othersMock = new Mock<ISingleClientProxy>();
        _contextMock = new Mock<HubCallerContext>();

        _clientsMock.Setup(c => c.Caller).Returns(_callerMock.Object);
        _clientsMock.Setup(c => c.Others).Returns(_othersMock.Object);
        _contextMock.Setup(c => c.ConnectionId).Returns("test-connection-id");

        _hub = new AgentHub(
            _connectionManagerMock.Object,
            _authServiceMock.Object,
            _loggerMock.Object)
        {
            Clients = _clientsMock.Object,
            Context = _contextMock.Object
        };
    }

    // --- RegisterAgent ---

    [Fact]
    public async Task RegisterAgent_ShouldAddConnection()
    {
        await _hub.RegisterAgent("agent-1", "developer");

        _connectionManagerMock.Verify(m => m.AddConnectionAsync(
            "test-connection-id", "agent-1", "developer", null),
            Times.Once);
    }

    [Fact]
    public async Task RegisterAgent_WithMetadata_ShouldPassMetadata()
    {
        var metadata = new Dictionary<string, object> { ["env"] = "test" };

        await _hub.RegisterAgent("agent-1", "developer", metadata);

        _connectionManagerMock.Verify(m => m.AddConnectionAsync(
            "test-connection-id", "agent-1", "developer", metadata),
            Times.Once);
    }

    [Fact]
    public async Task RegisterAgent_ShouldNotifyOtherAgents()
    {
        await _hub.RegisterAgent("agent-1", "developer");

        _othersMock.Verify(m => m.SendCoreAsync(
            "AgentConnected",
            It.Is<object?[]>(args => args.Length == 1),
            default),
            Times.Once);
    }

    // --- SendMessage (broadcast) ---

    [Fact]
    public async Task SendMessage_ShouldBroadcastToOthers()
    {
        var message = new AgentMessage
        {
            MessageType = "task_assignment",
            SenderId = "agent-1",
            Payload = new { task = "implement-feature" }
        };

        await _hub.SendMessage(message);

        _othersMock.Verify(m => m.SendCoreAsync(
            "ReceiveMessage",
            It.Is<object?[]>(args => args.Length == 1 && args[0] == message),
            default),
            Times.Once);
    }

    [Fact]
    public async Task SendMessage_ShouldUpdateActivity()
    {
        var message = new AgentMessage
        {
            MessageType = "heartbeat",
            SenderId = "agent-1"
        };

        await _hub.SendMessage(message);

        _connectionManagerMock.Verify(m =>
            m.UpdateActivityAsync("test-connection-id"), Times.Once);
    }

    [Fact]
    public async Task SendMessage_MultipleMessages_ShouldBroadcastEach()
    {
        var msg1 = new AgentMessage { MessageType = "task_claim", SenderId = "agent-1" };
        var msg2 = new AgentMessage { MessageType = "task_progress", SenderId = "agent-1" };
        var msg3 = new AgentMessage { MessageType = "task_complete", SenderId = "agent-1" };

        await _hub.SendMessage(msg1);
        await _hub.SendMessage(msg2);
        await _hub.SendMessage(msg3);

        _othersMock.Verify(m => m.SendCoreAsync(
            "ReceiveMessage",
            It.IsAny<object?[]>(),
            default),
            Times.Exactly(3));
    }

    // --- SendMessageToAgent (unicast) ---

    [Fact]
    public async Task SendMessageToAgent_RecipientConnected_ShouldSendToRecipient()
    {
        var recipientConnection = new AgentConnection
        {
            ConnectionId = "recipient-conn",
            AgentId = "agent-2",
            Role = "tester"
        };
        _connectionManagerMock.Setup(m => m.GetAgentConnections("agent-2"))
            .Returns(new[] { recipientConnection });

        var clientProxyMock = new Mock<IClientProxy>();
        _clientsMock.Setup(c => c.Clients(It.Is<IReadOnlyList<string>>(
            list => list.Contains("recipient-conn"))))
            .Returns(clientProxyMock.Object);

        var message = new AgentMessage
        {
            MessageType = "task_assignment",
            SenderId = "agent-1",
            RecipientId = "agent-2"
        };

        await _hub.SendMessageToAgent("agent-2", message);

        clientProxyMock.Verify(m => m.SendCoreAsync(
            "ReceiveMessage",
            It.Is<object?[]>(args => args.Length == 1 && args[0] == message),
            default),
            Times.Once);
    }

    [Fact]
    public async Task SendMessageToAgent_RecipientNotConnected_ShouldSendError()
    {
        _connectionManagerMock.Setup(m => m.GetAgentConnections("agent-2"))
            .Returns(Enumerable.Empty<AgentConnection>());

        var message = new AgentMessage
        {
            MessageType = "task_assignment",
            SenderId = "agent-1",
            RecipientId = "agent-2"
        };

        await _hub.SendMessageToAgent("agent-2", message);

        _callerMock.Verify(m => m.SendCoreAsync(
            "MessageError",
            It.Is<object?[]>(args => args.Length == 1),
            default),
            Times.Once);
    }

    [Fact]
    public async Task SendMessageToAgent_ShouldUpdateActivity()
    {
        _connectionManagerMock.Setup(m => m.GetAgentConnections("agent-2"))
            .Returns(Enumerable.Empty<AgentConnection>());

        var message = new AgentMessage { MessageType = "ping", SenderId = "agent-1" };
        await _hub.SendMessageToAgent("agent-2", message);

        _connectionManagerMock.Verify(m =>
            m.UpdateActivityAsync("test-connection-id"), Times.Once);
    }

    [Fact]
    public async Task SendMessageToAgent_MultipleRecipientConnections_ShouldSendToAll()
    {
        var connections = new[]
        {
            new AgentConnection { ConnectionId = "conn-a", AgentId = "agent-2", Role = "tester" },
            new AgentConnection { ConnectionId = "conn-b", AgentId = "agent-2", Role = "tester" }
        };
        _connectionManagerMock.Setup(m => m.GetAgentConnections("agent-2"))
            .Returns(connections);

        var clientProxyMock = new Mock<IClientProxy>();
        _clientsMock.Setup(c => c.Clients(It.Is<IReadOnlyList<string>>(
            list => list.Contains("conn-a") && list.Contains("conn-b"))))
            .Returns(clientProxyMock.Object);

        var message = new AgentMessage { MessageType = "task_update", SenderId = "agent-1" };
        await _hub.SendMessageToAgent("agent-2", message);

        clientProxyMock.Verify(m => m.SendCoreAsync(
            "ReceiveMessage",
            It.IsAny<object?[]>(),
            default),
            Times.Once);
    }

    // --- Heartbeat ---

    [Fact]
    public async Task Heartbeat_ShouldUpdateActivity()
    {
        _connectionManagerMock.Setup(m => m.GetConnection("test-connection-id"))
            .Returns(new AgentConnection { AgentId = "agent-1", ConnectionId = "test-connection-id" });

        await _hub.Heartbeat();

        _connectionManagerMock.Verify(m =>
            m.UpdateActivityAsync("test-connection-id"), Times.Once);
    }

    [Fact]
    public async Task Heartbeat_ShouldSendAcknowledgement()
    {
        _connectionManagerMock.Setup(m => m.GetConnection("test-connection-id"))
            .Returns(new AgentConnection { AgentId = "agent-1", ConnectionId = "test-connection-id" });

        await _hub.Heartbeat();

        _callerMock.Verify(m => m.SendCoreAsync(
            "HeartbeatAck",
            It.Is<object?[]>(args => args.Length == 1),
            default),
            Times.Once);
    }

    [Fact]
    public async Task Heartbeat_NoConnection_ShouldNotSendAck()
    {
        _connectionManagerMock.Setup(m => m.GetConnection("test-connection-id"))
            .Returns((AgentConnection?)null);

        await _hub.Heartbeat();

        _callerMock.Verify(m => m.SendCoreAsync(
            "HeartbeatAck",
            It.IsAny<object?[]>(),
            default),
            Times.Never);
    }

    // --- GetConnectedAgents ---

    [Fact]
    public async Task GetConnectedAgents_ShouldReturnAllConnections()
    {
        var connections = new[]
        {
            new AgentConnection { AgentId = "agent-1", Role = "developer", ConnectionId = "c1" },
            new AgentConnection { AgentId = "agent-2", Role = "tester", ConnectionId = "c2" }
        };
        _connectionManagerMock.Setup(m => m.GetAllConnections()).Returns(connections);

        await _hub.GetConnectedAgents();

        _callerMock.Verify(m => m.SendCoreAsync(
            "ConnectedAgents",
            It.Is<object?[]>(args => args.Length == 1),
            default),
            Times.Once);
    }

    [Fact]
    public async Task GetConnectedAgents_Empty_ShouldReturnEmptyList()
    {
        _connectionManagerMock.Setup(m => m.GetAllConnections())
            .Returns(Enumerable.Empty<AgentConnection>());

        await _hub.GetConnectedAgents();

        _callerMock.Verify(m => m.SendCoreAsync(
            "ConnectedAgents",
            It.Is<object?[]>(args => args.Length == 1),
            default),
            Times.Once);
    }

    // --- QueryStatus ---

    [Fact]
    public async Task QueryStatus_ConnectedAgent_ShouldReturnConnectedStatus()
    {
        _connectionManagerMock.Setup(m => m.IsAgentConnected("agent-1")).Returns(true);
        _connectionManagerMock.Setup(m => m.GetAgentConnections("agent-1"))
            .Returns(new[] { new AgentConnection { AgentId = "agent-1", ConnectionId = "c1" } });

        await _hub.QueryStatus("agent-1");

        _callerMock.Verify(m => m.SendCoreAsync(
            "AgentStatus",
            It.Is<object?[]>(args => args.Length == 1),
            default),
            Times.Once);
    }

    [Fact]
    public async Task QueryStatus_DisconnectedAgent_ShouldReturnDisconnectedStatus()
    {
        _connectionManagerMock.Setup(m => m.IsAgentConnected("agent-1")).Returns(false);
        _connectionManagerMock.Setup(m => m.GetAgentConnections("agent-1"))
            .Returns(Enumerable.Empty<AgentConnection>());

        await _hub.QueryStatus("agent-1");

        _callerMock.Verify(m => m.SendCoreAsync(
            "AgentStatus",
            It.Is<object?[]>(args => args.Length == 1),
            default),
            Times.Once);
    }

    // --- OnDisconnectedAsync ---

    [Fact]
    public async Task OnDisconnectedAsync_RegisteredAgent_ShouldRemoveAndNotify()
    {
        var connection = new AgentConnection
        {
            ConnectionId = "test-connection-id",
            AgentId = "agent-1",
            Role = "developer"
        };
        _connectionManagerMock.Setup(m => m.GetConnection("test-connection-id"))
            .Returns(connection);

        await _hub.OnDisconnectedAsync(null);

        _connectionManagerMock.Verify(m =>
            m.RemoveConnectionAsync("test-connection-id"), Times.Once);
        _othersMock.Verify(m => m.SendCoreAsync(
            "AgentDisconnected",
            It.Is<object?[]>(args => args.Length == 1),
            default),
            Times.Once);
    }

    [Fact]
    public async Task OnDisconnectedAsync_UnregisteredConnection_ShouldNotNotify()
    {
        _connectionManagerMock.Setup(m => m.GetConnection("test-connection-id"))
            .Returns((AgentConnection?)null);

        await _hub.OnDisconnectedAsync(null);

        _connectionManagerMock.Verify(m =>
            m.RemoveConnectionAsync(It.IsAny<string>()), Times.Never);
        _othersMock.Verify(m => m.SendCoreAsync(
            "AgentDisconnected",
            It.IsAny<object?[]>(),
            default),
            Times.Never);
    }

    [Fact]
    public async Task OnDisconnectedAsync_WithException_ShouldStillRemove()
    {
        var connection = new AgentConnection
        {
            ConnectionId = "test-connection-id",
            AgentId = "agent-1",
            Role = "developer"
        };
        _connectionManagerMock.Setup(m => m.GetConnection("test-connection-id"))
            .Returns(connection);

        var exception = new Exception("connection lost");
        await _hub.OnDisconnectedAsync(exception);

        _connectionManagerMock.Verify(m =>
            m.RemoveConnectionAsync("test-connection-id"), Times.Once);
    }
}

public class AgentHubMessageFlowTests
{
    private readonly Mock<IConnectionManager> _connectionManagerMock;
    private readonly Mock<IAuthenticationService> _authServiceMock;
    private readonly Mock<ILogger<AgentHub>> _loggerMock;
    private readonly AgentHub _hub;
    private readonly Mock<IHubCallerClients> _clientsMock;
    private readonly Mock<ISingleClientProxy> _callerMock;
    private readonly Mock<ISingleClientProxy> _othersMock;

    public AgentHubMessageFlowTests()
    {
        _connectionManagerMock = new Mock<IConnectionManager>();
        _authServiceMock = new Mock<IAuthenticationService>();
        _loggerMock = new Mock<ILogger<AgentHub>>();
        _clientsMock = new Mock<IHubCallerClients>();
        _callerMock = new Mock<ISingleClientProxy>();
        _othersMock = new Mock<ISingleClientProxy>();
        var contextMock = new Mock<HubCallerContext>();

        _clientsMock.Setup(c => c.Caller).Returns(_callerMock.Object);
        _clientsMock.Setup(c => c.Others).Returns(_othersMock.Object);
        contextMock.Setup(c => c.ConnectionId).Returns("sender-conn");

        _hub = new AgentHub(
            _connectionManagerMock.Object,
            _authServiceMock.Object,
            _loggerMock.Object)
        {
            Clients = _clientsMock.Object,
            Context = contextMock.Object
        };
    }

    [Fact]
    public async Task BroadcastMessage_ShouldPreserveAllMessageFields()
    {
        var message = new AgentMessage
        {
            ProtocolVersion = "1.0.0",
            MessageType = "task_assignment",
            SenderId = "agent-1",
            RecipientId = null,
            CorrelationId = "corr-123",
            Priority = "high",
            Payload = new { taskId = "task-1", description = "Build feature X" },
            Metadata = new Dictionary<string, object> { ["retry"] = 0 }
        };

        await _hub.SendMessage(message);

        _othersMock.Verify(m => m.SendCoreAsync(
            "ReceiveMessage",
            It.Is<object?[]>(args =>
                args.Length == 1 &&
                args[0] != null &&
                ((AgentMessage)args[0]!).MessageType == "task_assignment" &&
                ((AgentMessage)args[0]!).SenderId == "agent-1" &&
                ((AgentMessage)args[0]!).CorrelationId == "corr-123" &&
                ((AgentMessage)args[0]!).Priority == "high"),
            default),
            Times.Once);
    }

    [Fact]
    public async Task MessageTypes_AllSupportedTypes_ShouldBroadcast()
    {
        var messageTypes = new[]
        {
            "agent_join", "agent_leave", "task_assignment",
            "task_claim", "task_progress", "task_complete",
            "task_failed", "status_query", "status_response"
        };

        foreach (var msgType in messageTypes)
        {
            var message = new AgentMessage
            {
                MessageType = msgType,
                SenderId = "agent-1"
            };
            await _hub.SendMessage(message);
        }

        _othersMock.Verify(m => m.SendCoreAsync(
            "ReceiveMessage",
            It.IsAny<object?[]>(),
            default),
            Times.Exactly(messageTypes.Length));
    }

    [Fact]
    public async Task UnicastMessage_WithPayload_ShouldDeliverPayload()
    {
        var recipientConn = new AgentConnection
        {
            ConnectionId = "recv-conn",
            AgentId = "agent-2",
            Role = "tester"
        };
        _connectionManagerMock.Setup(m => m.GetAgentConnections("agent-2"))
            .Returns(new[] { recipientConn });

        var clientProxyMock = new Mock<IClientProxy>();
        _clientsMock.Setup(c => c.Clients(It.IsAny<IReadOnlyList<string>>()))
            .Returns(clientProxyMock.Object);

        var message = new AgentMessage
        {
            MessageType = "task_result",
            SenderId = "agent-1",
            RecipientId = "agent-2",
            Payload = new { result = "success", artifacts = new[] { "file1.ts", "file2.ts" } }
        };

        await _hub.SendMessageToAgent("agent-2", message);

        clientProxyMock.Verify(m => m.SendCoreAsync(
            "ReceiveMessage",
            It.Is<object?[]>(args =>
                args.Length == 1 &&
                args[0] != null &&
                ((AgentMessage)args[0]!).Payload != null),
            default),
            Times.Once);
    }

    [Fact]
    public async Task RegisterAndBroadcast_FullWorkflow()
    {
        // Step 1: Agent registers
        await _hub.RegisterAgent("agent-1", "developer");

        _connectionManagerMock.Verify(m => m.AddConnectionAsync(
            "sender-conn", "agent-1", "developer", null), Times.Once);

        // Step 2: Agent sends a broadcast message
        var taskMsg = new AgentMessage
        {
            MessageType = "task_claim",
            SenderId = "agent-1",
            Payload = new { taskId = "task-42" }
        };
        await _hub.SendMessage(taskMsg);

        // Step 3: Agent sends heartbeat
        _connectionManagerMock.Setup(m => m.GetConnection("sender-conn"))
            .Returns(new AgentConnection { AgentId = "agent-1", ConnectionId = "sender-conn" });
        await _hub.Heartbeat();

        // Verify all activity updates happened
        _connectionManagerMock.Verify(m =>
            m.UpdateActivityAsync("sender-conn"), Times.Exactly(2));
    }
}
