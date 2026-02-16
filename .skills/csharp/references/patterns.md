# C# Patterns Reference

## Contents
- SignalR Hub Authentication
- Thread-Safe State Management
- Timing-Safe Token Comparison
- Dependency Injection Lifetimes
- Hub Testing with Moq
- Anti-Patterns

---

## SignalR Hub Authentication

Authentication happens in `OnConnectedAsync()`, not middleware. The hub extracts tokens from query string OR Authorization header:

```csharp
// From AgentHub.cs - Token extraction
var httpContext = Context.GetHttpContext();
var token = httpContext?.Request.Query["access_token"].ToString();

if (string.IsNullOrEmpty(token))
{
    var authHeader = httpContext?.Request.Headers["Authorization"].ToString() ?? string.Empty;
    token = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
        ? authHeader.Substring(7).Trim()
        : authHeader;
}

if (string.IsNullOrEmpty(token) || !await _authService.ValidateTokenAsync(token))
{
    Context.Abort();
    return;
}
```

**Why query string?** SignalR's `accessTokenFactory` sends tokens as `?access_token=` on the WebSocket handshake request. The Authorization header is a fallback for HTTP-based transports.

---

## Thread-Safe State Management

All connection state uses `ConcurrentDictionary` for lock-free thread safety:

```csharp
// From ConnectionManager.cs
private readonly ConcurrentDictionary<string, AgentConnection> _connections = new();

public Task AddConnectionAsync(string connectionId, string agentId, string role,
    Dictionary<string, object>? metadata = null)
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
    return Task.CompletedTask;
}
```

**Multiple connections per agent** are supported. Query by agent ID filters the full dictionary:

```csharp
public IEnumerable<AgentConnection> GetAgentConnections(string agentId)
{
    return _connections.Values.Where(c => c.AgentId == agentId);
}
```

---

## Timing-Safe Token Comparison

NEVER use `==` or `string.Equals` for token comparison. Use XOR-based constant-time comparison:

```csharp
// From AuthenticationService.cs
private bool TimingSafeCompare(string a, string b)
{
    if (a.Length != b.Length) return false;

    var aBytes = System.Text.Encoding.UTF8.GetBytes(a);
    var bBytes = System.Text.Encoding.UTF8.GetBytes(b);

    int result = 0;
    for (int i = 0; i < aBytes.Length; i++)
    {
        result |= aBytes[i] ^ bBytes[i];
    }

    return result == 0;
}
```

**Why:** Standard string comparison short-circuits on first mismatch. An attacker can measure response times to determine how many characters of a token are correct, extracting it one byte at a time.

---

## Dependency Injection Lifetimes

Both core services are registered as **Singleton** because they hold in-memory state:

```csharp
// From Program.cs
builder.Services.AddSingleton<IConnectionManager, ConnectionManager>();
builder.Services.AddSingleton<IAuthenticationService, AuthenticationService>();
```

| Lifetime | When to Use | This Project |
|----------|-------------|--------------|
| Singleton | Shared state, thread-safe services | `ConnectionManager`, `AuthenticationService` |
| Scoped | Per-request state, DbContext | Future EF Core context |
| Transient | Stateless utilities | Not used currently |

### WARNING: Scoped Services in Singleton Hubs

SignalR hubs are **transient** but resolved from the **root scope**. Injecting a scoped service (like `DbContext`) into a hub will cause a captive dependency bug.

```csharp
// BAD - DbContext is scoped, hub resolves from root
public AgentHub(MyDbContext db) { }

// GOOD - Use IServiceScopeFactory to create per-operation scopes
public AgentHub(IServiceScopeFactory scopeFactory)
{
    using var scope = scopeFactory.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<MyDbContext>();
}
```

---

## Hub Testing with Moq

SignalR hub testing requires mocking `IHubCallerClients`, `HubCallerContext`, and `ISingleClientProxy`:

```csharp
// From AgentHubTests.cs - Standard test setup
private readonly Mock<IHubCallerClients> _clientsMock = new();
private readonly Mock<ISingleClientProxy> _callerMock = new();
private readonly Mock<ISingleClientProxy> _othersMock = new();
private readonly Mock<HubCallerContext> _contextMock = new();
private readonly Mock<IConnectionManager> _connectionManagerMock = new();
private readonly Mock<IAuthenticationService> _authServiceMock = new();

public AgentHubTests()
{
    _clientsMock.Setup(c => c.Caller).Returns(_callerMock.Object);
    _clientsMock.Setup(c => c.Others).Returns(_othersMock.Object);
    _contextMock.Setup(c => c.ConnectionId).Returns("test-connection-id");

    _hub = new AgentHub(_connectionManagerMock.Object, _authServiceMock.Object)
    {
        Clients = _clientsMock.Object,
        Context = _contextMock.Object
    };
}
```

**Verifying hub sent a message to clients:**

```csharp
[Fact]
public async Task SendMessage_ShouldBroadcast()
{
    var message = new AgentMessage { MessageType = "heartbeat", SenderId = "agent-1" };

    await _hub.SendMessage(message);

    _othersMock.Verify(
        c => c.SendCoreAsync("ReceiveMessage", It.IsAny<object[]>(), default),
        Times.Once);
}
```

**Verifying unicast to specific clients:**

```csharp
// Mock Clients.Clients(connectionIds) for unicast
var recipientMock = new Mock<ISingleClientProxy>();
_clientsMock
    .Setup(c => c.Clients(It.Is<IReadOnlyList<string>>(
        ids => ids.Contains("recipient-conn-id"))))
    .Returns(recipientMock.Object);
```

---

## Anti-Patterns

### WARNING: String Token Comparison

**The Problem:**

```csharp
// BAD - Vulnerable to timing attacks
public bool ValidateToken(string token) => token == _sharedToken;
```

**Why This Breaks:**
1. `==` short-circuits on first mismatched character
2. Attacker measures response time differences (microseconds)
3. After ~256 requests per position, the full token is extracted

**The Fix:** Use the XOR comparison shown above, or `CryptographicOperations.FixedTimeEquals()` (.NET 6+).

### WARNING: Blocking Calls in Hub Methods

**The Problem:**

```csharp
// BAD - Blocks the SignalR thread pool
public void ProcessData(string data)
{
    var result = _service.HeavyComputation(data);  // synchronous
    Clients.Caller.SendAsync("Result", result).Wait();  // .Wait() blocks
}
```

**Why This Breaks:**
1. SignalR has a limited thread pool for hub invocations
2. Blocking calls starve other connections
3. `.Wait()` or `.Result` on async calls can deadlock

**The Fix:**

```csharp
// GOOD - Fully async
public async Task ProcessData(string data)
{
    var result = await _service.HeavyComputationAsync(data);
    await Clients.Caller.SendAsync("Result", result);
}
```

### WARNING: Mutable State Without Concurrency Control

**The Problem:**

```csharp
// BAD - Dictionary is not thread-safe
private readonly Dictionary<string, AgentConnection> _connections = new();
```

**Why This Breaks:** Multiple SignalR connections hitting `Add`/`Remove` simultaneously causes `InvalidOperationException` or lost updates.

**The Fix:** Use `ConcurrentDictionary<TKey, TValue>` as `ConnectionManager` does.

### WARNING: Missing Null Check on `GetConnection`

**The Problem:**

```csharp
// BAD - GetConnection returns null if not found
var connection = _connectionManager.GetConnection(Context.ConnectionId);
await Clients.Others.SendAsync("Event", connection.AgentId);  // NullReferenceException
```

**The Fix:**

```csharp
var connection = _connectionManager.GetConnection(Context.ConnectionId);
if (connection == null) return;
```

Every hub method in `AgentHub.cs` follows this guard pattern. Do not skip it.
