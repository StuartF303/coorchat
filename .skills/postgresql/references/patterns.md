# PostgreSQL + EF Core Patterns

## Contents
- Entity Design
- DbContext Configuration
- JSONB Columns
- Array Columns and GIN Indexes
- Repository Pattern
- Anti-Patterns

---

## Entity Design

Entities live in `CoorChat.RelayServer.Core/Models/`. Current POCOs must be extended with EF Core conventions.

### Agent Entity (Extending AgentConnection)

```csharp
// Core/Entities/AgentEntity.cs
public class AgentEntity
{
    public Guid Id { get; set; }
    public string AgentId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public string Status { get; set; } = "disconnected";
    public Guid? CurrentTaskId { get; set; }
    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public CapabilityEntity? Capability { get; set; }
    public ICollection<MessageEntity> SentMessages { get; set; } = new List<MessageEntity>();
}
```

### Message Entity (Extending AgentMessage)

```csharp
public class MessageEntity
{
    public Guid Id { get; set; }
    public string ProtocolVersion { get; set; } = "1.0";
    public string MessageType { get; set; } = string.Empty;
    public Guid SenderId { get; set; }
    public Guid? RecipientId { get; set; }
    public Guid? TaskId { get; set; }
    public int Priority { get; set; } = 5;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public Guid? CorrelationId { get; set; }
    public string DeliveryStatus { get; set; } = "queued";

    // JSONB column — maps to PostgreSQL jsonb type
    public JsonDocument? Payload { get; set; }

    // Navigation
    public AgentEntity? Sender { get; set; }
}
```

---

## DbContext Configuration

```csharp
// Data/DbContext/RelayDbContext.cs
public class RelayDbContext : DbContext
{
    public RelayDbContext(DbContextOptions<RelayDbContext> options) : base(options) { }

    public DbSet<AgentEntity> Agents => Set<AgentEntity>();
    public DbSet<MessageEntity> Messages => Set<MessageEntity>();
    public DbSet<TaskEntity> Tasks => Set<TaskEntity>();
    public DbSet<ChannelEntity> Channels => Set<ChannelEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(RelayDbContext).Assembly);
    }
}
```

### Entity Type Configuration (Preferred over Data Annotations)

```csharp
// Data/Configurations/MessageEntityConfiguration.cs
public class MessageEntityConfiguration : IEntityTypeConfiguration<MessageEntity>
{
    public void Configure(EntityTypeBuilder<MessageEntity> builder)
    {
        builder.ToTable("messages");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasDefaultValueSql("gen_random_uuid()");
        builder.Property(m => m.MessageType).HasMaxLength(50).IsRequired();
        builder.Property(m => m.DeliveryStatus).HasMaxLength(20).HasDefaultValue("queued");
        builder.Property(m => m.Timestamp).HasDefaultValueSql("now()");

        // JSONB column
        builder.Property(m => m.Payload).HasColumnType("jsonb");

        // Indexes (from data-model.md spec)
        builder.HasIndex(m => new { m.SenderId, m.Timestamp })
               .IsDescending(false, true);
        builder.HasIndex(m => m.Timestamp);
        builder.HasIndex(m => m.TaskId)
               .HasFilter("task_id IS NOT NULL");
    }
}
```

---

## JSONB Columns

PostgreSQL JSONB is critical for `Message.Payload` and `Capability.CustomMetadata`. Npgsql maps `JsonDocument` or strongly-typed objects to `jsonb`.

### Option A: JsonDocument (Flexible, Untyped)

```csharp
// Entity
public JsonDocument? Payload { get; set; }

// Configuration
builder.Property(m => m.Payload).HasColumnType("jsonb");

// Query — use EF.Functions for JSONB operators
var taskMessages = await context.Messages
    .Where(m => EF.Functions.JsonContains(m.Payload, @"{""taskId"": ""abc-123""}"))
    .ToListAsync();
```

### Option B: Strongly-Typed POCO (Preferred for Known Schemas)

```csharp
// Entity
public TaskAssignedPayload? Payload { get; set; }

// Configuration — Npgsql serializes/deserializes automatically
builder.Property(m => m.Payload).HasColumnType("jsonb");

// Query — standard LINQ works
var urgent = await context.Messages
    .Where(m => m.Payload != null && m.Payload.Priority > 8)
    .ToListAsync();
```

### WARNING: JSONB Indexing

**The Problem:** Querying unindexed JSONB columns causes full table scans on 14,400+ messages/day.

**The Fix:** Create GIN indexes on frequently queried JSONB paths:

```sql
CREATE INDEX idx_messages_payload_taskid ON messages USING GIN ((payload -> 'taskId'));
```

Or in EF Core migration:

```csharp
migrationBuilder.Sql(
    "CREATE INDEX idx_messages_payload_taskid ON messages USING GIN ((payload -> 'taskId'))");
```

---

## Array Columns and GIN Indexes

The `Task` entity uses UUID arrays for `AssignedAgents` and `Dependencies`. Npgsql maps `List<Guid>` to PostgreSQL `uuid[]`.

```csharp
// Entity
public class TaskEntity
{
    public Guid Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public List<Guid> AssignedAgents { get; set; } = new();
    public List<Guid> Dependencies { get; set; } = new();
    public string Status { get; set; } = "available";
}

// Configuration — GIN index for array containment queries
builder.HasIndex(t => t.AssignedAgents).HasMethod("GIN");

// Query — array containment
var agentTasks = await context.Tasks
    .Where(t => t.AssignedAgents.Contains(agentId))
    .ToListAsync();
```

---

## Repository Pattern

Repositories go in `CoorChat.RelayServer.Data/Repositories/`. Register as **Scoped** (matches DbContext lifetime).

```csharp
// Data/Repositories/IMessageRepository.cs
public interface IMessageRepository
{
    Task<IEnumerable<MessageEntity>> GetByChannelAsync(Guid channelId, DateTime? since = null);
    Task AddAsync(MessageEntity message);
    Task<int> PurgeOldMessagesAsync(int retentionDays);
}

// Data/Repositories/MessageRepository.cs
public class MessageRepository : IMessageRepository
{
    private readonly RelayDbContext _context;

    public MessageRepository(RelayDbContext context) => _context = context;

    public async Task<int> PurgeOldMessagesAsync(int retentionDays)
    {
        var cutoff = DateTime.UtcNow.AddDays(-retentionDays);
        return await _context.Messages
            .Where(m => m.Timestamp < cutoff)
            .ExecuteDeleteAsync();  // EF Core 7+ bulk delete — no loading into memory
    }
}

// Program.cs registration
builder.Services.AddScoped<IMessageRepository, MessageRepository>();
```

---

## Anti-Patterns

### WARNING: Singleton DbContext

**The Problem:**

```csharp
// BAD — DbContext is not thread-safe
builder.Services.AddSingleton<RelayDbContext>();
```

**Why This Breaks:** `DbContext` tracks entities internally and is NOT thread-safe. With SignalR handling concurrent connections, a singleton DbContext causes data corruption, stale reads, and `InvalidOperationException` on concurrent `SaveChangesAsync` calls.

**The Fix:** Always register as Scoped. Use `IServiceScopeFactory` in Singleton services (like `ConnectionManager`) that need database access.

### WARNING: N+1 Queries in Agent Lookups

**The Problem:**

```csharp
// BAD — one query per agent
var agents = await context.Agents.ToListAsync();
foreach (var agent in agents)
{
    agent.Capability = await context.Capabilities.FirstOrDefaultAsync(c => c.AgentId == agent.Id);
}
```

**The Fix:**

```csharp
// GOOD — single query with eager loading
var agents = await context.Agents
    .Include(a => a.Capability)
    .ToListAsync();
```

### WARNING: Missing Connection Pooling

**The Problem:** Default Npgsql pool is 100 connections. Under load (50+ agents sending heartbeats every 15s), pool exhaustion causes `NpgsqlException: The connection pool has been exhausted`.

**The Fix:** Tune pool size in connection string and use short-lived DbContext scopes:

```
Host=localhost;Database=coorchat;Minimum Pool Size=10;Maximum Pool Size=200;Connection Idle Lifetime=60
```
