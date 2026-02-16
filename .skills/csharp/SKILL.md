---
name: csharp
description: |
  Develops ASP.NET Core 8.0 relay server with SignalR hubs, token authentication, and EF Core persistence.
  Use when: writing or modifying C# code in packages/relay-server/, adding SignalR hub methods, implementing authentication, creating xUnit tests with Moq, or configuring ASP.NET Core services.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# C# / ASP.NET Core Relay Server

The relay server (`packages/relay-server/`) is a .NET 8.0 SignalR hub for real-time agent coordination. All persistence is currently in-memory via `ConcurrentDictionary`. The EF Core data layer (`CoorChat.RelayServer.Data`) is scaffolded but empty.

## Project Layout

```
packages/relay-server/
├── src/
│   ├── CoorChat.RelayServer.Api/         # Hub, middleware, Program.cs
│   ├── CoorChat.RelayServer.Core/        # Models, services, interfaces
│   └── CoorChat.RelayServer.Data/        # EF Core (stubbed, no DbContext yet)
└── tests/
    ├── CoorChat.RelayServer.Tests.Unit/  # 51 tests (xUnit + Moq)
    └── CoorChat.RelayServer.Tests.Integration/  # Empty
```

## Quick Start

```bash
# Build
cd packages/relay-server && dotnet build

# Test
dotnet test

# Run
dotnet run --project src/CoorChat.RelayServer.Api
```

## Key Patterns

| Pattern | Location | Usage |
|---------|----------|-------|
| Hub auth in `OnConnectedAsync` | `AgentHub.cs` | Token validation on WebSocket handshake, not middleware |
| `ConcurrentDictionary` state | `ConnectionManager.cs` | Thread-safe in-memory connection tracking |
| Timing-safe token comparison | `AuthenticationService.cs` | XOR-based byte comparison prevents timing attacks |
| `Singleton` DI lifetime | `Program.cs` | Both `IConnectionManager` and `IAuthenticationService` |
| Middleware path exclusion | `AuthenticationMiddleware.cs` | Skip `/agentHub` and `/health` paths |

## Hub Methods (Client -> Server)

| Method | Purpose | Returns to Client |
|--------|---------|-------------------|
| `RegisterAgent(agentId, role, metadata)` | Register connection | `AgentConnected` to Others |
| `SendMessage(message)` | Broadcast | `ReceiveMessage` to Others |
| `SendMessageToAgent(recipientId, message)` | Unicast | `ReceiveMessage` to recipient |
| `Heartbeat()` | Keep-alive | `HeartbeatAck` to Caller |
| `GetConnectedAgents()` | List agents | `ConnectedAgents` to Caller |
| `QueryStatus(agentId)` | Check agent | `AgentStatus` to Caller |

## Common Operations

### Adding a Hub Method

```csharp
public async Task MyNewMethod(string param)
{
    var connection = _connectionManager.GetConnection(Context.ConnectionId);
    if (connection == null) return;

    _connectionManager.UpdateActivityAsync(Context.ConnectionId);
    await Clients.Others.SendAsync("MyNewEvent", new { param, agentId = connection.AgentId });
}
```

### Registering a New Service

```csharp
// In Program.cs
builder.Services.AddSingleton<IMyService, MyService>();

// Inject in Hub constructor
public AgentHub(IConnectionManager cm, IAuthenticationService auth, IMyService myService)
```

## WARNING: Auth Middleware vs Hub Auth

SignalR authentication MUST happen in `OnConnectedAsync()`, not in `AuthenticationMiddleware`. The middleware explicitly skips `/agentHub` because SignalR's negotiation endpoint needs to be accessible before the WebSocket handshake completes.

## See Also

- [patterns](references/patterns.md) - Architecture, DI, testing patterns
- [workflows](references/workflows.md) - Build, test, deploy workflows

## Related Skills

- See the **aspnet** skill for ASP.NET Core middleware and routing patterns
- See the **signalr** skill for SignalR client/server protocol details
- See the **postgresql** skill for EF Core + Npgsql data layer (when implemented)
- See the **docker** skill for container build and deployment
- See the **typescript** skill for the MCP server that connects to this relay

## Documentation Resources

> Fetch latest ASP.NET Core documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "ASP.NET Core" or "EF Core"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repos
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library IDs:**
- ASP.NET Core docs: `/websites/learn_microsoft_en-us_aspnet_core`
- EF Core source: `/dotnet/efcore`

**Recommended Queries:**
- "SignalR hub authentication and authorization"
- "ConcurrentDictionary thread-safe patterns"
- "xUnit test patterns with Moq for SignalR hubs"
- "EF Core PostgreSQL setup and migrations"
