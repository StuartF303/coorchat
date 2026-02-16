# C# Workflows Reference

## Contents
- Build and Test
- Adding a Hub Method End-to-End
- Adding a New Service
- Writing Unit Tests
- Docker Build and Deploy
- EF Core Migration (Future)

---

## Build and Test

```bash
# Build solution
cd packages/relay-server && dotnet build

# Run all tests (51 passing)
dotnet test

# Verbose test output
dotnet test --logger "console;verbosity=detailed"

# Coverage report
dotnet test --collect:"XPlat Code Coverage"

# Run specific test class
dotnet test --filter "FullyQualifiedName~AgentHubTests"

# Build release
dotnet build -c Release

# Run the server
dotnet run --project src/CoorChat.RelayServer.Api
```

Copy this checklist and track progress:
- [ ] `dotnet build` passes with no errors
- [ ] `dotnet test` shows 51+ tests passing
- [ ] No new warnings introduced

---

## Adding a Hub Method End-to-End

### 1. Define the method in `AgentHub.cs`

```csharp
public async Task PingAgent(string targetAgentId)
{
    var connection = _connectionManager.GetConnection(Context.ConnectionId);
    if (connection == null) return;

    await _connectionManager.UpdateActivityAsync(Context.ConnectionId);

    var targetConnections = _connectionManager
        .GetAgentConnections(targetAgentId)
        .Select(c => c.ConnectionId)
        .ToList();

    if (targetConnections.Count == 0)
    {
        await Clients.Caller.SendAsync("MessageError",
            $"Agent {targetAgentId} is not connected", null);
        return;
    }

    await Clients.Clients(targetConnections).SendAsync("PingReceived",
        new { FromAgentId = connection.AgentId, Timestamp = DateTime.UtcNow });
}
```

### 2. Write unit tests

```csharp
[Fact]
public async Task PingAgent_ConnectedTarget_ShouldSendPing()
{
    var targetConnections = new List<AgentConnection>
    {
        new() { ConnectionId = "target-conn", AgentId = "target-1", Role = "tester" }
    };
    _connectionManagerMock
        .Setup(cm => cm.GetAgentConnections("target-1"))
        .Returns(targetConnections);

    var recipientMock = new Mock<ISingleClientProxy>();
    _clientsMock
        .Setup(c => c.Clients(It.Is<IReadOnlyList<string>>(
            ids => ids.Contains("target-conn"))))
        .Returns(recipientMock.Object);

    await _hub.PingAgent("target-1");

    recipientMock.Verify(
        c => c.SendCoreAsync("PingReceived", It.IsAny<object[]>(), default),
        Times.Once);
}

[Fact]
public async Task PingAgent_DisconnectedTarget_ShouldSendError()
{
    _connectionManagerMock
        .Setup(cm => cm.GetAgentConnections("missing-agent"))
        .Returns(Enumerable.Empty<AgentConnection>());

    await _hub.PingAgent("missing-agent");

    _callerMock.Verify(
        c => c.SendCoreAsync("MessageError", It.IsAny<object[]>(), default),
        Times.Once);
}
```

### 3. Validate

1. Run `dotnet test`
2. If tests fail, fix and rerun
3. Only proceed when all tests pass

Copy this checklist:
- [ ] Hub method implemented with null guard
- [ ] Activity timestamp updated
- [ ] Error case handled (agent not found)
- [ ] Unit test for success path
- [ ] Unit test for error path
- [ ] `dotnet test` passes

---

## Adding a New Service

### 1. Define interface in `CoorChat.RelayServer.Core/Services/`

```csharp
public interface IMetricsService
{
    Task RecordMessageAsync(string agentId, string messageType);
    Task<Dictionary<string, int>> GetMessageCountsAsync();
}
```

### 2. Implement in same directory

```csharp
public class MetricsService : IMetricsService
{
    private readonly ConcurrentDictionary<string, int> _counts = new();

    public Task RecordMessageAsync(string agentId, string messageType)
    {
        var key = $"{agentId}:{messageType}";
        _counts.AddOrUpdate(key, 1, (_, count) => count + 1);
        return Task.CompletedTask;
    }

    public Task<Dictionary<string, int>> GetMessageCountsAsync()
    {
        return Task.FromResult(new Dictionary<string, int>(_counts));
    }
}
```

### 3. Register in `Program.cs`

```csharp
builder.Services.AddSingleton<IMetricsService, MetricsService>();
```

### 4. Inject into Hub

```csharp
public class AgentHub : Hub
{
    private readonly IConnectionManager _connectionManager;
    private readonly IAuthenticationService _authService;
    private readonly IMetricsService _metrics;

    public AgentHub(IConnectionManager cm, IAuthenticationService auth, IMetricsService metrics)
    {
        _connectionManager = cm;
        _authService = auth;
        _metrics = metrics;
    }
}
```

### WARNING: Singleton vs Scoped Lifetime

Choose Singleton for in-memory state (like `ConcurrentDictionary`-backed services). When the EF Core data layer is implemented, `DbContext` MUST be Scoped. See the **postgresql** skill for EF Core patterns.

---

## Writing Unit Tests

### Test file structure follows xUnit conventions:

```csharp
using Moq;
using Xunit;

namespace CoorChat.RelayServer.Tests.Unit.Services;

public class MetricsServiceTests
{
    private readonly MetricsService _service;

    public MetricsServiceTests()
    {
        _service = new MetricsService();
    }

    [Fact]
    public async Task RecordMessage_ShouldIncrementCount()
    {
        await _service.RecordMessageAsync("agent-1", "heartbeat");
        await _service.RecordMessageAsync("agent-1", "heartbeat");

        var counts = await _service.GetMessageCountsAsync();
        Assert.Equal(2, counts["agent-1:heartbeat"]);
    }

    [Fact]
    public async Task GetMessageCounts_Empty_ShouldReturnEmptyDictionary()
    {
        var counts = await _service.GetMessageCountsAsync();
        Assert.Empty(counts);
    }
}
```

### Hub test setup pattern (from `AgentHubTests.cs`):

Mock setup is verbose but follows a repeatable pattern. The key mocks:

| Mock | Purpose |
|------|---------|
| `Mock<IHubCallerClients>` | Routes `.Caller`, `.Others`, `.Clients()` |
| `Mock<ISingleClientProxy>` | Verifies `SendCoreAsync` calls |
| `Mock<HubCallerContext>` | Provides `ConnectionId`, `GetHttpContext()` |
| `Mock<IConnectionManager>` | Stubs connection lookups |
| `Mock<IAuthenticationService>` | Stubs token validation |

### WARNING: Verify `SendCoreAsync`, Not `SendAsync`

Moq intercepts the internal `SendCoreAsync` method, not the extension method `SendAsync`:

```csharp
// BAD - This won't verify correctly
_callerMock.Verify(c => c.SendAsync("Event", It.IsAny<object>(), default));

// GOOD - Verify the internal method
_callerMock.Verify(
    c => c.SendCoreAsync("Event", It.IsAny<object[]>(), default),
    Times.Once);
```

---

## Docker Build and Deploy

### Build the image

```bash
cd packages/relay-server
docker build -t coorchat-relay .
```

### Run with token configuration

```bash
docker run -d \
  -p 5000:5000 -p 5001:5001 \
  -e Authentication__SharedToken=cct_your_production_token \
  -e ASPNETCORE_ENVIRONMENT=Production \
  coorchat-relay
```

### Multi-stage Dockerfile breakdown

The Dockerfile uses two stages:
1. **Build** (`sdk:8.0-alpine`): Restore, build, publish
2. **Runtime** (`aspnet:8.0-alpine`): Non-root user, health check, minimal image

**Security:** Runs as non-root user `coorchat` (UID 1001). NEVER change this to root.

### Health check

```bash
curl http://localhost:5000/health
# Returns: Healthy
```

### Connection stats

```bash
curl -H "Authorization: Bearer cct_your_token" http://localhost:5000/api/stats
```

See the **docker** skill for container orchestration patterns.

---

## EF Core Migration (Future)

The `CoorChat.RelayServer.Data` project has EF Core + Npgsql packages but no implementation yet. When adding persistence:

```bash
# Add initial migration
cd src/CoorChat.RelayServer.Data
dotnet ef migrations add InitialCreate --startup-project ../CoorChat.RelayServer.Api

# Apply migration
dotnet ef database update --startup-project ../CoorChat.RelayServer.Api
```

Copy this checklist for EF Core setup:
- [ ] Create `RelayServerDbContext` in Data project
- [ ] Define entity classes with EF conventions
- [ ] Register `DbContext` as **Scoped** in `Program.cs`
- [ ] Use `IServiceScopeFactory` in Hub (not direct injection)
- [ ] Add connection string to `appsettings.json`
- [ ] Create and apply initial migration
- [ ] Update Docker Compose with PostgreSQL service

See the **postgresql** skill for Npgsql-specific configuration.
