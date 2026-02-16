# PostgreSQL + EF Core Workflows

## Contents
- Migration Workflow
- Docker Setup
- CI/CD Integration Tests
- Message Retention Service
- Transitioning from In-Memory to PostgreSQL
- Testing with PostgreSQL

---

## Migration Workflow

All migrations are managed from the `CoorChat.RelayServer.Data` project with `--startup-project` pointing to the API project (which has the connection string).

### Creating a Migration

```bash
cd packages/relay-server/src/CoorChat.RelayServer.Data
dotnet ef migrations add <MigrationName> --startup-project ../CoorChat.RelayServer.Api
```

### Applying Migrations

```bash
# Development
dotnet ef database update --startup-project ../CoorChat.RelayServer.Api

# Production — generate SQL script instead
dotnet ef migrations script --startup-project ../CoorChat.RelayServer.Api --idempotent -o migration.sql
```

### Migration Checklist

Copy this checklist and track progress:
- [ ] Create entity class in `Core/Entities/`
- [ ] Create `IEntityTypeConfiguration<T>` in `Data/Configurations/`
- [ ] Add `DbSet<T>` to `RelayDbContext`
- [ ] Run `dotnet ef migrations add <Name> --startup-project ../CoorChat.RelayServer.Api`
- [ ] Review generated migration file for correctness
- [ ] Apply: `dotnet ef database update --startup-project ../CoorChat.RelayServer.Api`
- [ ] Verify with: `dotnet ef dbcontext info --startup-project ../CoorChat.RelayServer.Api`

### WARNING: Never Edit Applied Migrations

**The Problem:** Modifying a migration that has already been applied to a database causes schema drift. EF Core tracks applied migrations in `__EFMigrationsHistory` — if the code changes but the table says it's applied, future migrations break.

**The Fix:** Always create a new migration. If you need to undo, use `dotnet ef migrations remove` (only works on the latest unapplied migration) or create a corrective migration.

---

## Docker Setup

The `docker-compose.yml` currently has no PostgreSQL service. Add one:

```yaml
# Add to docker-compose.yml services:
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: coorchat
    POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
    POSTGRES_DB: coorchat
  ports:
    - "5432:5432"
  volumes:
    - postgres-data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U coorchat"]
    interval: 10s
    timeout: 5s
    retries: 5

# Add to volumes:
volumes:
  postgres-data:
```

Then uncomment and update the relay-server service:

```yaml
relay-server:
  build:
    context: ./packages/relay-server
    dockerfile: Dockerfile
  environment:
    - ASPNETCORE_ENVIRONMENT=Development
    - ConnectionStrings__DefaultConnection=Host=postgres;Port=5432;Database=coorchat;Username=coorchat;Password=${DB_PASSWORD:-changeme}
  ports:
    - "5000:5000"
    - "5001:5001"
  depends_on:
    postgres:
      condition: service_healthy
```

### Docker Workflow

```bash
# Start PostgreSQL only
docker compose up -d postgres

# Verify PostgreSQL is ready
docker compose exec postgres pg_isready -U coorchat

# Connect with psql
docker compose exec postgres psql -U coorchat -d coorchat

# Start everything
docker compose up -d
```

---

## CI/CD Integration Tests

The CI workflow (`.github/workflows/relay-server-ci.yml`) already provisions `postgres:16-alpine` with these credentials:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: coorchat
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: coorchat_test
```

Connection string injected via environment:
```
Host=localhost;Port=5432;Database=coorchat_test;Username=coorchat;Password=test_password
```

### Writing Integration Tests

See the **csharp** skill for xUnit patterns. Use `WebApplicationFactory` with a test database:

```csharp
// Tests.Integration/RelayServerFactory.cs
public class RelayServerFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace DbContext with test database
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<RelayDbContext>));
            if (descriptor != null) services.Remove(descriptor);

            services.AddDbContext<RelayDbContext>(options =>
                options.UseNpgsql(
                    Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                    ?? "Host=localhost;Port=5432;Database=coorchat_test;Username=coorchat;Password=test_password"));
        });
    }
}
```

```csharp
// Tests.Integration/MessagePersistenceTests.cs
public class MessagePersistenceTests : IClassFixture<RelayServerFactory>
{
    private readonly RelayServerFactory _factory;

    public MessagePersistenceTests(RelayServerFactory factory) => _factory = factory;

    [Fact]
    public async Task Messages_ArePersisted_AfterBroadcast()
    {
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<RelayDbContext>();

        await context.Database.EnsureCreatedAsync();

        var message = new MessageEntity
        {
            MessageType = "task_assigned",
            SenderId = Guid.NewGuid(),
            Priority = 8
        };
        context.Messages.Add(message);
        await context.SaveChangesAsync();

        var persisted = await context.Messages.FindAsync(message.Id);
        Assert.NotNull(persisted);
        Assert.Equal("task_assigned", persisted.MessageType);
    }
}
```

### Integration Test Checklist

Copy this checklist and track progress:
- [ ] Ensure `postgres:16-alpine` service is in CI workflow
- [ ] Create `RelayServerFactory` with test DbContext
- [ ] Write tests that call `EnsureCreatedAsync()` (or apply migrations)
- [ ] Run: `dotnet test tests/CoorChat.RelayServer.Tests.Integration/ --configuration Release`
- [ ] Verify tests pass locally against Docker PostgreSQL
- [ ] Verify tests pass in CI (check GitHub Actions output)

---

## Message Retention Service

The data model specifies 30-day retention with ~14,400 messages/day. Use a `BackgroundService` with `ExecuteDeleteAsync` for efficient bulk purge.

```csharp
// Api/Services/MessageRetentionService.cs
public class MessageRetentionService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MessageRetentionService> _logger;
    private readonly int _retentionDays;

    public MessageRetentionService(
        IServiceScopeFactory scopeFactory,
        ILogger<MessageRetentionService> logger,
        IConfiguration config)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _retentionDays = config.GetValue("Retention:Days", 30);
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<RelayDbContext>();

                var cutoff = DateTime.UtcNow.AddDays(-_retentionDays);
                var deleted = await context.Messages
                    .Where(m => m.Timestamp < cutoff)
                    .ExecuteDeleteAsync(ct);

                _logger.LogInformation("Purged {Count} messages older than {Days} days", deleted, _retentionDays);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Message retention purge failed");
            }

            await Task.Delay(TimeSpan.FromHours(24), ct);
        }
    }
}

// Register in Program.cs
builder.Services.AddHostedService<MessageRetentionService>();
```

### WARNING: Don't Use ToList + RemoveRange for Bulk Deletes

**The Problem:**

```csharp
// BAD — loads all rows into memory, then deletes one by one
var old = await context.Messages.Where(m => m.Timestamp < cutoff).ToListAsync();
context.Messages.RemoveRange(old);
await context.SaveChangesAsync();
```

**Why This Breaks:** With 30 days × 14,400 messages/day = 432,000 rows loaded into memory. OOM on constrained containers.

**The Fix:** `ExecuteDeleteAsync()` (EF Core 7+) generates a single `DELETE FROM messages WHERE timestamp < @cutoff` — no entity loading.

---

## Transitioning from In-Memory to PostgreSQL

The relay server currently uses `ConcurrentDictionary` in `ConnectionManager`. Transitioning requires:

1. **Keep in-memory for hot path** — `ConnectionManager` stays as-is for real-time connection tracking (SignalR needs sub-millisecond lookups)
2. **Add persistence for durability** — Write-through to PostgreSQL for agent history, message audit trail, and task state
3. **Read from DB for cold queries** — Historical queries, analytics, and retention use the database

```csharp
// Hybrid approach: in-memory for real-time, DB for persistence
public class PersistentConnectionManager : IConnectionManager
{
    private readonly ConcurrentDictionary<string, AgentConnection> _connections = new();
    private readonly IServiceScopeFactory _scopeFactory;

    public async Task AddConnectionAsync(string connectionId, string agentId, string role,
        Dictionary<string, object>? metadata = null)
    {
        // In-memory (fast path)
        var connection = new AgentConnection { ConnectionId = connectionId, AgentId = agentId, Role = role };
        _connections.TryAdd(connectionId, connection);

        // Persist (async, non-blocking)
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<RelayDbContext>();
        context.Agents.Add(new AgentEntity { AgentId = agentId, Role = role, Status = "connected" });
        await context.SaveChangesAsync();
    }

    // GetConnection stays in-memory only — no DB round-trip for hot path
    public AgentConnection? GetConnection(string connectionId)
    {
        _connections.TryGetValue(connectionId, out var connection);
        return connection;
    }
}
```

### Transition Checklist

Copy this checklist and track progress:
- [ ] Create `RelayDbContext` with all entity DbSets
- [ ] Create `IEntityTypeConfiguration<T>` for each entity
- [ ] Add connection string to `appsettings.json` and `appsettings.Development.json`
- [ ] Register DbContext in `Program.cs` (Scoped lifetime)
- [ ] Create initial migration and apply
- [ ] Add PostgreSQL service to `docker-compose.yml`
- [ ] Implement repository interfaces and classes
- [ ] Update `ConnectionManager` to write-through to DB
- [ ] Register `MessageRetentionService` as hosted service
- [ ] Write integration tests against real PostgreSQL
- [ ] Verify CI pipeline passes with `postgres:16-alpine` service

### Validate-and-Iterate Pattern

1. Make entity/configuration changes
2. Run: `dotnet ef migrations add <Name> --startup-project ../CoorChat.RelayServer.Api`
3. Review migration file — check for unintended column drops or renames
4. If migration looks wrong, run: `dotnet ef migrations remove --startup-project ../CoorChat.RelayServer.Api`
5. Fix configuration and repeat from step 2
6. Apply: `dotnet ef database update --startup-project ../CoorChat.RelayServer.Api`
7. Run tests: `dotnet test`
8. Only proceed when all tests pass

---

## Connection String Security

### WARNING: Hardcoded Credentials

**The Problem:**

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=prod-db;Password=s3cret_password"
  }
}
```

**Why This Breaks:** Connection strings in `appsettings.json` get committed to git. Production database credentials exposed.

**The Fix:** Use environment variable override in production:

```bash
# Docker / CI
ConnectionStrings__DefaultConnection="Host=prod-db;Password=${DB_PASSWORD};SslMode=Require"

# appsettings.json — development only, no real secrets
"DefaultConnection": "Host=localhost;Port=5432;Database=coorchat;Username=coorchat;Password=dev_only"
```

The double-underscore (`__`) syntax maps to nested JSON keys in ASP.NET Core configuration. See the **csharp** skill for configuration binding patterns.
