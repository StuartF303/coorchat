# Research & Technology Decisions

**Feature**: Multi-Agent Coordination System
**Branch**: `001-multi-agent-coordination`
**Date**: 2026-02-14

## Overview

This document consolidates research findings for technology choices and architectural patterns for the Multi-Agent Coordination System. Each section presents a decision, rationale, and alternatives considered.

---

## 1. Channel Abstraction Pattern

### Decision
**Strategy Pattern with Factory**

Use the Strategy pattern to encapsulate channel-specific behavior, combined with a Factory pattern for channel instantiation.

```typescript
interface Channel {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(message: Message): Promise<void>;
  onMessage(handler: (message: Message) => void): void;
}

class ChannelFactory {
  create(type: ChannelType, config: ChannelConfig): Channel {
    switch (type) {
      case 'discord': return new DiscordChannel(config);
      case 'signalr': return new SignalRChannel(config);
      case 'redis': return new RedisChannel(config);
      case 'relay': return new RelayChannel(config);
    }
  }
}
```

### Rationale
- **Strategy Pattern**: Allows runtime channel switching without modifying client code
- **Factory Pattern**: Centralizes channel creation logic, simplifies testing with mock channels
- **Interface-based**: TypeScript interfaces ensure compile-time type safety across all channels
- **Testability**: Easy to mock channels for unit testing

### Alternatives Considered
- **Plugin Architecture**: More flexible but adds complexity (dynamic loading, version management)
  - Rejected: Over-engineered for 4 known channel types
- **Abstract Base Class**: More coupling than interface
  - Rejected: Interface composition is more flexible in TypeScript

---

## 2. Message Protocol Design

### Decision
**JSON Schema with Semantic Versioning**

Use JSON Schema for message validation with semantic versioning (major.minor) in message headers.

```json
{
  "protocolVersion": "1.0",
  "messageType": "task_assigned",
  // ... message fields
}
```

**Compatibility Rules**:
- **Minor version changes** (1.0 → 1.1): Additive only (new optional fields)
- **Major version changes** (1.x → 2.0): Breaking changes allowed
- **Backward compatibility**: Support N and N-1 major versions

### Rationale
- **JSON Schema**: Industry standard, excellent tooling (validation, code generation)
- **Semantic Versioning**: Clear compatibility contract
- **Header versioning**: Enables protocol negotiation before parsing payload
- **Validation**: Catch protocol errors early, provide clear error messages

### Alternatives Considered
- **Protobuf**: More efficient but adds build complexity
  - Rejected: JSON is human-readable, easier debugging, native in Node.js
- **GraphQL subscriptions**: Over-engineered for point-to-point messages
  - Rejected: Not designed for peer-to-peer agent communication
- **No versioning**: Simpler but breaks on protocol changes
  - Rejected: System needs to support gradual agent upgrades

---

## 3. Real-time Performance

### Decision
**Use native client libraries with connection pooling**

- **Discord.js v14**: ~50-100 concurrent connections per process, ~50MB memory per bot
- **@microsoft/signalr**: ~1000 concurrent connections, ~2MB per connection
- **ioredis**: ~10,000 concurrent connections, ~1MB per connection

**Performance Strategy**:
- Connection pooling for Redis (reuse connections)
- Single bot instance for Discord (Discord API limitation)
- SignalR hub connections per agent

### Rationale
- **Discord.js**: Mature library, handles rate limiting automatically
- **SignalR Client**: Official Microsoft library, excellent TypeScript support
- **ioredis**: High-performance Redis client with cluster support
- **Meets Requirements**: 20-50 agents well within limits of all channels

### Research Sources
- Discord.js documentation: Gateway intents, rate limiting
- SignalR performance benchmarks: Connection limits, message throughput
- ioredis benchmarks: Pipeline performance, memory usage

### Alternatives Considered
- **Custom WebSocket implementation**: More control but reinvents wheel
  - Rejected: Existing libraries handle reconnection, rate limiting, protocol complexities
- **Lower-level libraries (ws, net)**: More complexity
  - Rejected: Discord, SignalR have specific protocol requirements

---

## 4. GitHub Integration

### Decision
**Webhooks primary, polling fallback with conditional requests**

```typescript
class GitHubSyncManager {
  async initialize() {
    if (await this.setupWebhook()) {
      this.webhookMode = true;
    } else {
      this.startPolling(interval = 30s);
    }
  }

  async poll() {
    // Use If-Modified-Since, ETags for efficient polling
    const response = await octokit.issues.listForRepo({
      headers: { 'If-Modified-Since': lastSync }
    });
    if (response.status === 304) return; // Not modified
    // Process changes
  }
}
```

**Webhook Delivery**:
- GitHub guarantees "at least once" delivery
- Implement idempotency (deduplicate events by delivery ID)
- 30-second timeout for webhook endpoint

**Polling Fallback**:
- Default: 30 seconds interval
- Use conditional requests (If-Modified-Since, ETag) to reduce API quota usage
- Exponential backoff on rate limit errors

### Rationale
- **Webhooks**: Near real-time updates (<5s), efficient
- **Polling Fallback**: Works in restricted environments (CI/CD with no inbound connections)
- **Conditional Requests**: 60x API quota savings (304 responses don't count against quota)
- **Idempotency**: Prevents duplicate task notifications from webhook retries

### Research Sources
- GitHub webhooks documentation: Delivery guarantees, retry logic
- GitHub API rate limiting: Conditional requests, quota management
- Octokit.js best practices

### Alternatives Considered
- **Polling only**: Simpler but wastes API quota and adds latency
  - Rejected: Webhooks provide better user experience
- **Webhooks only**: Doesn't work in restricted environments
  - Rejected: Must support CI/CD pipelines without inbound connectivity
- **GraphQL subscriptions**: GitHub doesn't support real-time subscriptions
  - Not available from GitHub

---

## 5. Cross-platform Docker

### Decision
**Multi-platform builds using Docker Buildx with GitHub Actions matrix**

```yaml
# .github/workflows/mcp-server-ci.yml
strategy:
  matrix:
    platform: [linux/amd64, linux/arm64]

steps:
  - uses: docker/setup-buildx-action@v2
  - uses: docker/build-push-action@v4
    with:
      platforms: ${{ matrix.platform }}
      cache-from: type=gha
      cache-to: type=gha,mode=max
```

**Image Optimization**:
- Multi-stage builds (build → runtime)
- Alpine-based images for minimal size
- Layer caching with GitHub Actions cache
- Target size: <200MB (Node.js base ~50MB + deps ~100MB + app ~50MB)

### Rationale
- **Buildx**: Official Docker tool for multi-platform builds
- **GitHub Actions**: Free for open source, integrated caching
- **Alpine**: Minimal base image (5MB vs Ubuntu 28MB)
- **Layer Caching**: Speeds up CI/CD, reduces build times from 10min to <2min

### Research Sources
- Docker Buildx documentation
- GitHub Actions Docker build optimization guides
- Node.js Docker best practices (official Node.js Docker images)

### Alternatives Considered
- **Build on native runners**: Slower, requires multiple runners
  - Rejected: Buildx emulation faster than native ARM runners
- **Separate Dockerfiles per platform**: Maintenance burden
  - Rejected: Single Dockerfile with buildx is cleaner

---

## 6. Rate Limiting

### Decision
**Exponential backoff with jitter and circuit breaker**

```typescript
class ExponentialBackoff {
  async retry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (!isRetryable(error)) throw error;
        const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s, 16s
        const jitter = Math.random() * 1000; // 0-1s jitter
        await sleep(baseDelay + jitter);
      }
    }
    throw new Error('Max retries exceeded');
  }
}

class CircuitBreaker {
  // Open circuit after 5 consecutive failures
  // Half-open after 60s, allow one request
  // Close if request succeeds
}
```

**Rate Limit Header Parsing**:
- Discord: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- GitHub: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Preemptive throttling when remaining < 10%

### Rationale
- **Exponential Backoff**: Industry standard (2^n formula)
- **Jitter**: Prevents thundering herd (multiple agents retrying simultaneously)
- **Circuit Breaker**: Prevents cascading failures, fast-fails when service is down
- **Header Parsing**: Proactive rate limiting prevents 429 errors

### Research Sources
- AWS Architecture Blog: Exponential Backoff and Jitter
- Discord API rate limiting documentation
- GitHub API rate limiting best practices
- Martin Fowler: Circuit Breaker pattern

### Alternatives Considered
- **Linear backoff**: Less effective, longer retry times
  - Rejected: Exponential is standard for distributed systems
- **No jitter**: Can cause thundering herd
  - Rejected: Jitter is essential for multi-agent scenarios
- **Fixed delays**: Doesn't adapt to temporary vs persistent failures
  - Rejected: Exponential backoff adapts better

---

## 7. Configuration Management

### Decision
**Zod for schema validation with environment variable substitution**

```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  channel: z.object({
    type: z.enum(['discord', 'signalr', 'redis', 'relay']),
    token: z.string().min(1),
    retentionDays: z.number().int().positive().default(30),
  }),
  github: z.object({
    token: z.string().min(1),
    webhookSecret: z.string().optional(),
  }),
});

class ConfigLoader {
  load(path: string): Config {
    const raw = yaml.load(fs.readFileSync(path));
    const resolved = this.resolveEnvVars(raw); // ${GITHUB_TOKEN} → process.env.GITHUB_TOKEN
    return ConfigSchema.parse(resolved); // Validates and type-checks
  }
}
```

**Security**:
- Secrets via environment variables, not committed to config files
- Config files in `.gitignore` (template in `.coorchat/config.template.yaml`)
- Environment variable substitution: `${VAR_NAME}` syntax

### Rationale
- **Zod**: TypeScript-first validation, excellent error messages, type inference
- **YAML**: Human-readable, supports comments (better than JSON)
- **Env Var Substitution**: Follows 12-factor app principles, works in Docker
- **Schema Validation**: Catches configuration errors at startup, not runtime

### Research Sources
- Zod documentation
- 12-Factor App: Config management
- Node.js dotenv best practices

### Alternatives Considered
- **Joi**: Mature but not TypeScript-native
  - Rejected: Zod has better TypeScript integration
- **JSON Schema**: More verbose, requires separate type definitions
  - Rejected: Zod schemas are TypeScript types
- **Cosmiconfig**: Searches multiple config locations
  - Rejected: Over-engineered for single config file

---

## 8. Relay Server Storage

### Decision
**Entity Framework Core with PostgreSQL and message retention policies**

```csharp
public class RelayDbContext : DbContext {
  public DbSet<Channel> Channels { get; set; }
  public DbSet<Message> Messages { get; set; }
  public DbSet<Agent> Agents { get; set; }
}

// Message retention job
public class MessageRetentionService : BackgroundService {
  protected override async Task ExecuteAsync(CancellationToken ct) {
    while (!ct.IsCancellationRequested) {
      await PurgeOldMessages();
      await Task.Delay(TimeSpan.FromHours(24), ct);
    }
  }

  private async Task PurgeOldMessages() {
    var cutoff = DateTime.UtcNow.AddDays(-retentionDays);
    await _context.Messages.Where(m => m.Timestamp < cutoff).ExecuteDeleteAsync();
  }
}
```

**Performance Optimizations**:
- Index on `Messages.Timestamp` for purge queries
- Index on `Messages.ChannelId` for history retrieval
- Connection pooling (default pool size: 100)
- Asynchronous I/O for all database operations

### Rationale
- **Entity Framework Core**: Type-safe, migrations, excellent .NET integration
- **PostgreSQL**: Open source, JSON support (for message payloads), excellent performance
- **Retention Policies**: Automated cleanup prevents unbounded storage growth
- **Background Service**: .NET hosted service for scheduled tasks

### Research Sources
- Entity Framework Core documentation: Performance best practices
- PostgreSQL performance tuning guides
- ASP.NET Core background services

### Alternatives Considered
- **SQL Server**: Good performance but licensing costs
  - Considered: Support both PostgreSQL and SQL Server (EF Core abstracts)
- **MongoDB**: Better for unstructured data but overkill for structured messages
  - Rejected: Relational model fits message/channel/agent relationships
- **Dapper (micro-ORM)**: Faster but more manual SQL
  - Rejected: EF Core performance is sufficient, type safety is valuable

---

## Summary Table

| Area | Decision | Key Rationale |
|------|----------|---------------|
| Channel Abstraction | Strategy + Factory patterns | Runtime flexibility, testability |
| Message Protocol | JSON Schema + Semantic Versioning | Standard tooling, clear compatibility |
| Real-time Libs | Discord.js, SignalR client, ioredis | Mature, performant, handles edge cases |
| GitHub Integration | Webhooks + Polling fallback | Real-time + universal compatibility |
| Docker Builds | Multi-platform Buildx + Alpine | Cross-platform, minimal size |
| Rate Limiting | Exponential backoff + Jitter + Circuit breaker | Prevents cascading failures |
| Config Management | Zod + YAML + Env vars | Type-safe, 12-factor compliance |
| Relay Storage | EF Core + PostgreSQL | Type-safe, migrations, performance |

---

## Technology Stack Summary

### MCP Server (TypeScript/Node.js)
- **Runtime**: Node.js 18+ (LTS)
- **Language**: TypeScript 5.x
- **Channel Clients**: Discord.js v14, @microsoft/signalr, ioredis
- **GitHub API**: @octokit/rest
- **Config**: yaml, zod
- **Testing**: Jest/Vitest, Playwright
- **Build**: esbuild (fast TypeScript compilation)

### Relay Server (C#/.NET)
- **Runtime**: .NET 8.0
- **Framework**: ASP.NET Core
- **ORM**: Entity Framework Core 8.0
- **Database**: PostgreSQL 15+ (primary), SQL Server 2019+ (supported)
- **Real-time**: SignalR
- **Testing**: xUnit, TestContainers

### Infrastructure
- **CI/CD**: GitHub Actions
- **Containers**: Docker with Buildx
- **Registry**: DockerHub or GitHub Container Registry
- **Package**: npm (for MCP Server)

---

## Phase 0 Complete

All technology decisions validated. No "NEEDS CLARIFICATION" items remaining.

**Next**: Proceed to Phase 1 (Design & Contracts)
