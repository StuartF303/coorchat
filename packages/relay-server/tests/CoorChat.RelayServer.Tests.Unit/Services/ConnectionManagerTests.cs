using CoorChat.RelayServer.Core.Models;
using CoorChat.RelayServer.Core.Services;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace CoorChat.RelayServer.Tests.Unit.Services;

public class ConnectionManagerTests
{
    private readonly ConnectionManager _sut;
    private readonly Mock<ILogger<ConnectionManager>> _loggerMock;

    public ConnectionManagerTests()
    {
        _loggerMock = new Mock<ILogger<ConnectionManager>>();
        _sut = new ConnectionManager(_loggerMock.Object);
    }

    [Fact]
    public async Task AddConnectionAsync_ShouldStoreConnection()
    {
        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");

        var connection = _sut.GetConnection("conn-1");
        Assert.NotNull(connection);
        Assert.Equal("conn-1", connection.ConnectionId);
        Assert.Equal("agent-1", connection.AgentId);
        Assert.Equal("developer", connection.Role);
    }

    [Fact]
    public async Task AddConnectionAsync_ShouldSetTimestamps()
    {
        var before = DateTime.UtcNow;
        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");
        var after = DateTime.UtcNow;

        var connection = _sut.GetConnection("conn-1");
        Assert.NotNull(connection);
        Assert.InRange(connection.ConnectedAt, before, after);
        Assert.InRange(connection.LastActivity, before, after);
    }

    [Fact]
    public async Task AddConnectionAsync_WithMetadata_ShouldStoreMetadata()
    {
        var metadata = new Dictionary<string, object>
        {
            ["platform"] = "Linux",
            ["environment"] = "production"
        };

        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer", metadata);

        var connection = _sut.GetConnection("conn-1");
        Assert.NotNull(connection);
        Assert.Equal("Linux", connection.Metadata["platform"]);
        Assert.Equal("production", connection.Metadata["environment"]);
    }

    [Fact]
    public async Task AddConnectionAsync_WithoutMetadata_ShouldUseEmptyDictionary()
    {
        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");

        var connection = _sut.GetConnection("conn-1");
        Assert.NotNull(connection);
        Assert.Empty(connection.Metadata);
    }

    [Fact]
    public async Task AddConnectionAsync_DuplicateConnectionId_ShouldNotOverwrite()
    {
        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");
        await _sut.AddConnectionAsync("conn-1", "agent-2", "tester");

        var connection = _sut.GetConnection("conn-1");
        Assert.NotNull(connection);
        Assert.Equal("agent-1", connection.AgentId);
    }

    [Fact]
    public async Task RemoveConnectionAsync_ShouldRemoveConnection()
    {
        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");
        await _sut.RemoveConnectionAsync("conn-1");

        var connection = _sut.GetConnection("conn-1");
        Assert.Null(connection);
    }

    [Fact]
    public async Task RemoveConnectionAsync_NonExistentConnection_ShouldNotThrow()
    {
        await _sut.RemoveConnectionAsync("non-existent");
        // Should complete without throwing
    }

    [Fact]
    public void GetConnection_NonExistentId_ShouldReturnNull()
    {
        var connection = _sut.GetConnection("non-existent");
        Assert.Null(connection);
    }

    [Fact]
    public async Task GetAgentConnections_ShouldReturnAllConnectionsForAgent()
    {
        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");
        await _sut.AddConnectionAsync("conn-2", "agent-1", "developer");
        await _sut.AddConnectionAsync("conn-3", "agent-2", "tester");

        var connections = _sut.GetAgentConnections("agent-1").ToList();
        Assert.Equal(2, connections.Count);
        Assert.All(connections, c => Assert.Equal("agent-1", c.AgentId));
    }

    [Fact]
    public void GetAgentConnections_NoConnections_ShouldReturnEmpty()
    {
        var connections = _sut.GetAgentConnections("agent-1").ToList();
        Assert.Empty(connections);
    }

    [Fact]
    public async Task GetAllConnections_ShouldReturnAll()
    {
        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");
        await _sut.AddConnectionAsync("conn-2", "agent-2", "tester");
        await _sut.AddConnectionAsync("conn-3", "agent-3", "architect");

        var connections = _sut.GetAllConnections().ToList();
        Assert.Equal(3, connections.Count);
    }

    [Fact]
    public void GetAllConnections_Empty_ShouldReturnEmpty()
    {
        var connections = _sut.GetAllConnections().ToList();
        Assert.Empty(connections);
    }

    [Fact]
    public async Task UpdateActivityAsync_ShouldUpdateLastActivity()
    {
        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");
        var original = _sut.GetConnection("conn-1")!.LastActivity;

        await Task.Delay(10);
        await _sut.UpdateActivityAsync("conn-1");

        var updated = _sut.GetConnection("conn-1")!.LastActivity;
        Assert.True(updated >= original);
    }

    [Fact]
    public async Task UpdateActivityAsync_NonExistentConnection_ShouldNotThrow()
    {
        await _sut.UpdateActivityAsync("non-existent");
        // Should complete without throwing
    }

    [Fact]
    public async Task IsAgentConnected_ShouldReturnTrueForConnectedAgent()
    {
        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");

        Assert.True(_sut.IsAgentConnected("agent-1"));
    }

    [Fact]
    public void IsAgentConnected_ShouldReturnFalseForDisconnectedAgent()
    {
        Assert.False(_sut.IsAgentConnected("agent-1"));
    }

    [Fact]
    public async Task IsAgentConnected_AfterRemoval_ShouldReturnFalse()
    {
        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");
        await _sut.RemoveConnectionAsync("conn-1");

        Assert.False(_sut.IsAgentConnected("agent-1"));
    }

    [Fact]
    public async Task GetConnectionCount_ShouldTrackCount()
    {
        Assert.Equal(0, _sut.GetConnectionCount());

        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");
        Assert.Equal(1, _sut.GetConnectionCount());

        await _sut.AddConnectionAsync("conn-2", "agent-2", "tester");
        Assert.Equal(2, _sut.GetConnectionCount());

        await _sut.RemoveConnectionAsync("conn-1");
        Assert.Equal(1, _sut.GetConnectionCount());
    }

    [Fact]
    public async Task MultipleAgents_ShouldCoexistIndependently()
    {
        await _sut.AddConnectionAsync("conn-1", "agent-1", "developer");
        await _sut.AddConnectionAsync("conn-2", "agent-2", "tester");
        await _sut.AddConnectionAsync("conn-3", "agent-3", "architect");

        Assert.True(_sut.IsAgentConnected("agent-1"));
        Assert.True(_sut.IsAgentConnected("agent-2"));
        Assert.True(_sut.IsAgentConnected("agent-3"));

        await _sut.RemoveConnectionAsync("conn-2");

        Assert.True(_sut.IsAgentConnected("agent-1"));
        Assert.False(_sut.IsAgentConnected("agent-2"));
        Assert.True(_sut.IsAgentConnected("agent-3"));
        Assert.Equal(2, _sut.GetConnectionCount());
    }
}
