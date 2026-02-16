---
name: postgresql
description: |
  Designs EF Core schemas, migrations, and relay server persistence for the CoorChat relay server's PostgreSQL 16 data layer.
  Use when: creating or modifying EF Core entities, DbContext, migrations, repository classes in CoorChat.RelayServer.Data/, configuring PostgreSQL connection strings, writing integration tests against PostgreSQL, implementing message retention or data purge logic, or transitioning the relay server from in-memory to persistent storage.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# PostgreSQL + EF Core Data Layer

The relay server (`packages/relay-server/`) uses PostgreSQL 16 via Npgsql.EntityFrameworkCore.PostgreSQL 8.0. The `CoorChat.RelayServer.Data` project has NuGet packages installed but **no implementation yet** — all state lives in `ConcurrentDictionary` inside `ConnectionManager`. This skill guides building the persistent data layer.

## Current State

| Component | Status | Location |
|-----------|--------|----------|
| NuGet packages | Installed | `CoorChat.RelayServer.Data.csproj` |
| DbContext | **Not created** | `Data/DbContext/RelayDbContext.cs` (planned) |
| Entities | POCOs only | `Core/Models/AgentConnection.cs`, `AgentMessage.cs` |
| Repositories | **Not created** | `Data/Repositories/` (planned) |
| Migrations | **None** | `Data/Migrations/` (planned) |
| Connection string | **Not configured** | `appsettings.json` missing `ConnectionStrings` |

## Quick Start — Adding Persistence

### 1. Register DbContext in Program.cs

```csharp
// In Program.cs — add BEFORE service registrations
builder.Services.AddDbContext<RelayDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
```

### 2. Connection String Format

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=coorchat;Username=coorchat;Password=your_password"
  }
}
```

Production: `Host=db.example.com;Port=5432;Database=coorchat;Username=coorchat;Password=${DB_PASSWORD};SslMode=Require`

### 3. Create and Apply Migrations

```bash
cd packages/relay-server/src/CoorChat.RelayServer.Data
dotnet ef migrations add InitialCreate --startup-project ../CoorChat.RelayServer.Api
dotnet ef database update --startup-project ../CoorChat.RelayServer.Api
```

## Key Concepts

| Concept | This Project | Notes |
|---------|-------------|-------|
| Entities | `Agent`, `Message`, `Task`, `Channel`, `Capability` | Defined in `specs/001-multi-agent-coordination/data-model.md` |
| JSONB columns | `Message.Payload`, `Capability.CustomMetadata` | Use `.HasColumnType("jsonb")` |
| Array columns | `Task.AssignedAgents`, `Task.Dependencies` | Use `List<Guid>` with GIN index |
| Timestamps | All entities use `DateTime` UTC | `default(now())` in PostgreSQL |
| UUIDs | All primary keys are `Guid` | Npgsql maps `Guid` → `uuid` natively |

## WARNING: SignalR Hub Scoping

SignalR Hubs are **Transient**. DbContext is **Scoped**. NEVER inject DbContext directly into a Hub constructor — it will throw a DI scope error.

```csharp
// BAD — DI scope mismatch
public AgentHub(RelayDbContext context) { }

// GOOD — Create scope manually
public AgentHub(IServiceScopeFactory scopeFactory)
{
    using var scope = scopeFactory.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<RelayDbContext>();
}
```

## See Also

- [patterns](references/patterns.md) — Entity design, JSONB, indexes, repository pattern
- [workflows](references/workflows.md) — Migrations, Docker, CI/CD, retention

## Related Skills

- See the **csharp** skill for ASP.NET Core service registration and Hub patterns
- See the **signalr** skill for real-time client/server protocol
- See the **docker** skill for PostgreSQL container setup
- See the **github-actions** skill for CI integration test job with `postgres:16-alpine`

## Documentation Resources

> Fetch latest PostgreSQL or EF Core documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "postgresql" or "efcore"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repos
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library IDs:**
- PostgreSQL 16 docs: `/websites/postgresql_16`
- EF Core source: `/dotnet/efcore`
- Npgsql EF Core provider: `/websites/npgsql_efcore_index`

**Recommended Queries:**
- "JSONB column mapping and querying"
- "Array column with GIN index"
- "Connection pooling configuration"
- "EF Core PostgreSQL setup and migrations"
- "Bulk insert and ExecuteDeleteAsync"
