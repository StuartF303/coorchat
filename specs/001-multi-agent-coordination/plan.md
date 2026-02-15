# Implementation Plan: Multi-Agent Coordination System

**Branch**: `001-multi-agent-coordination` | **Date**: 2026-02-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-multi-agent-coordination/spec.md`

## Summary

Build a coordination system enabling multiple specialized AI agents (developer, tester, architect, frontend, backend, infrastructure, and custom roles) to collaborate on shared software development tasks in real-time. The system consists of two integrated components:

1. **MCP Server** (TypeScript/Node.js): Agent-facing coordination client providing MCP commands, GitHub integration, and channel abstraction
2. **CoorChat Relay Server** (C#/.NET): Optional custom relay server providing authenticated communications, centralized message history, and configuration management

Agents communicate through pluggable channels (Discord, SignalR, Redis, or CoorChat Relay) using a structured JSON protocol with versioning. The system supports cross-platform deployment (Linux/macOS/Windows), CI/CD pipeline execution, and autonomous agent onboarding with capability discovery.

## Technical Context

**Language/Version**:
- MCP Server: TypeScript 5.x / Node.js v18+
- Relay Server: C# / .NET 8.0+

**Primary Dependencies**:
- MCP Server: Discord.js, @microsoft/signalr, ioredis, @octokit/rest (GitHub API), ws (WebSockets)
- Relay Server: ASP.NET Core, SignalR, Entity Framework Core

**Storage**:
- Configuration: Local JSON/YAML files (`.coorchat/config.json`)
- Message History: Channel provider's native storage (Discord history, Redis persistence, Relay Server database)
- Relay Server: SQL database (PostgreSQL/SQL Server) for centralized storage

**Testing**:
- MCP Server: Jest/Vitest for unit tests, Playwright for integration tests
- Relay Server: xUnit for unit tests, integration tests with TestContainers

**Target Platform**:
- Linux (amd64, arm64), macOS, Windows
- Docker containers (primary distribution)
- npm packages (alternative distribution)
- CI/CD environments (GitHub Actions, Azure DevOps, AWS)

**Project Type**: Multi-project (MCP Server + Relay Server)

**Performance Goals**:
- Message latency: <2 seconds under normal network conditions
- Message delivery: 99.9% success rate
- Concurrent agents: 20-50 agents per channel
- GitHub sync: <5 seconds for work item updates
- Agent capability discovery: <5 seconds

**Constraints**:
- Installation time: <5 minutes (including Docker pull)
- Configuration time: <2 minutes per agent via MCP commands
- Reconnection time: <30 seconds after unexpected disconnection
- Docker image size: <500MB (target)
- Memory per agent: <200MB (target)

**Scale/Scope**:
- 20-50 concurrent agents per coordination channel
- 4 channel types supported (Discord, SignalR, Redis, CoorChat Relay)
- Cross-platform: 3 OS platforms × multiple environments
- Extensible agent roles (unlimited custom types)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: No constitution file found at `.specify/memory/constitution.md`

**Default Principles Applied**:
- ✅ Simplicity: Use pluggable architecture to avoid duplicating channel logic
- ✅ Testability: Structured protocol enables contract testing
- ✅ Maintainability: TypeScript provides type safety for message protocol
- ⚠️ Multi-project: Two separate components (MCP + Relay) required for different use cases

**Multi-Project Justification**:
| Component | Language | Rationale |
|-----------|----------|-----------|
| MCP Server | TypeScript/Node.js | Real-time messaging excellence, JSON-native, excellent Discord/SignalR/Redis libraries, cross-platform |
| Relay Server | C#/.NET | Optional component for teams wanting self-hosted solution, .NET ecosystem integration, SignalR native support |

**Re-evaluation after Phase 1**: Pending design completion

## Project Structure

### Documentation (this feature)

```text
specs/001-multi-agent-coordination/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output (technology decisions)
├── data-model.md        # Phase 1 output (entities & protocol)
├── quickstart.md        # Phase 1 output (getting started guide)
├── contracts/           # Phase 1 output (API contracts, protocol schemas)
│   ├── message-protocol.json      # JSON schema for message format
│   ├── capability-schema.json     # Agent capability registration format
│   ├── mcp-commands.yaml          # MCP command specifications
│   └── relay-api.openapi.yaml     # Relay Server API spec (if implemented)
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks - not created by /speckit.plan)
```

### Source Code (repository root)

```text
# MCP Server (TypeScript/Node.js)
packages/mcp-server/
├── src/
│   ├── channels/              # Channel abstraction layer
│   │   ├── base/
│   │   │   ├── Channel.ts            # Base channel interface
│   │   │   ├── ChannelFactory.ts     # Factory for creating channels
│   │   │   └── ChannelAdapter.ts     # Common adapter logic
│   │   ├── discord/
│   │   │   ├── DiscordChannel.ts
│   │   │   └── DiscordAdapter.ts
│   │   ├── signalr/
│   │   │   ├── SignalRChannel.ts
│   │   │   └── SignalRAdapter.ts
│   │   ├── redis/
│   │   │   ├── RedisChannel.ts
│   │   │   └── RedisAdapter.ts
│   │   └── relay/
│   │       ├── RelayChannel.ts
│   │       └── RelayAdapter.ts
│   ├── protocol/              # Message protocol implementation
│   │   ├── Message.ts               # Message type definitions
│   │   ├── MessageBuilder.ts        # Fluent message builder
│   │   ├── MessageValidator.ts      # Protocol validation
│   │   └── VersionManager.ts        # Protocol versioning
│   ├── agents/                # Agent management
│   │   ├── Agent.ts                 # Agent entity
│   │   ├── AgentRegistry.ts         # Agent tracking
│   │   ├── CapabilityManager.ts     # Capability registration/discovery
│   │   └── RoleManager.ts           # Custom role definitions
│   ├── tasks/                 # Task coordination
│   │   ├── Task.ts                  # Task entity
│   │   ├── TaskQueue.ts             # Task assignment queue
│   │   ├── ConflictResolver.ts      # Timestamp-based conflict resolution
│   │   └── DependencyTracker.ts     # Task dependency management
│   ├── github/                # GitHub integration
│   │   ├── GitHubClient.ts          # GitHub API wrapper
│   │   ├── WebhookHandler.ts        # Webhook receiver
│   │   ├── PollingService.ts        # Fallback polling
│   │   └── SyncManager.ts           # Work item synchronization
│   ├── config/                # Configuration management
│   │   ├── ConfigLoader.ts          # JSON/YAML config loader
│   │   ├── ConfigValidator.ts       # Config validation
│   │   └── EnvironmentResolver.ts   # Env var substitution
│   ├── mcp/                   # MCP command interface
│   │   ├── CommandHandler.ts        # MCP command dispatcher
│   │   ├── commands/
│   │   │   ├── ConfigureCommand.ts
│   │   │   ├── JoinCommand.ts
│   │   │   ├── StatusCommand.ts
│   │   │   └── CapabilitiesCommand.ts
│   │   └── ui/
│   │       └── TextUI.ts            # Text-based visual feedback
│   ├── logging/               # Observability
│   │   ├── Logger.ts                # Structured logger interface
│   │   ├── LogLevel.ts              # Log level enum
│   │   └── LogFormatter.ts          # Log formatting
│   ├── retry/                 # Rate limiting & retry
│   │   ├── RetryQueue.ts            # Request queue
│   │   ├── ExponentialBackoff.ts    # Backoff algorithm
│   │   └── RateLimiter.ts           # API rate limiting
│   └── index.ts               # Main entry point
├── tests/
│   ├── unit/
│   │   ├── protocol/
│   │   ├── agents/
│   │   ├── tasks/
│   │   └── channels/
│   ├── integration/
│   │   ├── github-sync.test.ts
│   │   ├── channel-switching.test.ts
│   │   └── multi-agent.test.ts
│   └── contract/
│       ├── message-protocol.test.ts
│       └── capability-schema.test.ts
├── package.json
├── tsconfig.json
└── Dockerfile

# CoorChat Relay Server (C#/.NET) - OPTIONAL COMPONENT
packages/relay-server/
├── src/
│   ├── CoorChat.RelayServer.Api/
│   │   ├── Controllers/
│   │   │   ├── ChannelController.cs       # Channel management API
│   │   │   ├── MessageController.cs       # Message relay API
│   │   │   └── ConfigController.cs        # Configuration API
│   │   ├── Hubs/
│   │   │   └── AgentHub.cs                # SignalR hub for real-time
│   │   ├── Middleware/
│   │   │   ├── AuthenticationMiddleware.cs
│   │   │   └── LoggingMiddleware.cs
│   │   ├── Program.cs
│   │   └── appsettings.json
│   ├── CoorChat.RelayServer.Core/
│   │   ├── Entities/
│   │   │   ├── Channel.cs
│   │   │   ├── Message.cs
│   │   │   ├── Agent.cs
│   │   │   └── Configuration.cs
│   │   ├── Services/
│   │   │   ├── IMessageRelayService.cs
│   │   │   ├── MessageRelayService.cs
│   │   │   ├── IChannelService.cs
│   │   │   ├── ChannelService.cs
│   │   │   └── AuthenticationService.cs
│   │   └── Interfaces/
│   └── CoorChat.RelayServer.Data/
│       ├── DbContext/
│       │   └── RelayDbContext.cs
│       ├── Repositories/
│       │   ├── IChannelRepository.cs
│       │   ├── ChannelRepository.cs
│       │   ├── IMessageRepository.cs
│       │   └── MessageRepository.cs
│       └── Migrations/
├── tests/
│   ├── CoorChat.RelayServer.Tests.Unit/
│   └── CoorChat.RelayServer.Tests.Integration/
├── CoorChat.RelayServer.sln
└── Dockerfile

# Shared
.github/
└── workflows/
    ├── mcp-server-ci.yml       # MCP Server build/test/publish
    └── relay-server-ci.yml     # Relay Server build/test/publish

docker-compose.yml              # Local development setup
README.md                       # Repository documentation
```

**Structure Decision**: Multi-project monorepo with two independent components:
1. **MCP Server (TypeScript/Node.js)**: Primary coordination client under `packages/mcp-server/`
2. **Relay Server (C#/.NET)**: Optional self-hosted relay under `packages/relay-server/`

This structure allows teams to use only the MCP Server with third-party channels (Discord/SignalR/Redis) or deploy both components for a fully self-hosted solution.

## Complexity Tracking

**No violations requiring justification**. The multi-project structure is necessary for:
- Different runtime environments (Node.js vs .NET)
- Optional deployment scenarios (MCP-only vs MCP+Relay)
- Language-specific ecosystem strengths (TypeScript for real-time, C# for SignalR native)

---

## Phase 0: Research & Technology Decisions

### Research Tasks

Based on Technical Context, the following areas require research to validate technology choices:

1. **Channel Abstraction Pattern**: Research best practices for multi-channel abstraction in TypeScript
   - Strategy pattern vs Factory pattern vs Plugin architecture
   - Ensure channel switching doesn't break existing connections

2. **Message Protocol Design**: Research JSON schema versioning strategies
   - Schema evolution patterns (add/remove fields)
   - Backward compatibility testing approaches
   - Protocol negotiation mechanisms

3. **Real-time Performance**: Research Discord.js, SignalR client, and ioredis performance characteristics
   - Concurrent connection limits
   - Message throughput benchmarks
   - Memory footprint per connection

4. **GitHub Integration**: Research webhook reliability and polling fallback patterns
   - Webhook delivery guarantees
   - Polling optimization (conditional requests, ETags)
   - Event deduplication strategies

5. **Cross-platform Docker**: Research multi-platform Docker image builds
   - GitHub Actions matrix builds for linux/amd64, linux/arm64, Windows
   - Image size optimization techniques
   - Platform-specific dependencies

6. **Rate Limiting**: Research exponential backoff algorithms
   - Standard backoff formulas (2^n, jitter)
   - Circuit breaker patterns
   - Rate limit header parsing (GitHub, Discord APIs)

7. **Configuration Management**: Research secure configuration storage
   - Environment variable substitution patterns
   - Secret management best practices
   - Configuration validation libraries (Joi, Zod)

8. **Relay Server Storage**: Research Entity Framework Core with PostgreSQL/SQL Server
   - Message retention/purging strategies
   - Query performance for message history
   - Connection pooling configuration

### Research Output Location

All research findings will be consolidated in `research.md` with decisions, rationales, and rejected alternatives.

---

## Phase 1: Design & Contracts

### Data Model (data-model.md)

Based on spec entities, create detailed data model covering:

**Core Entities**:
1. **Agent**: ID, role (extensible), platform, environment, capabilities, status, timestamp
2. **Message**: Protocol version, type, sender, recipient, task ID, priority, timestamp, correlation ID, payload
3. **Task**: ID, description, assigned agents, status, dependencies, GitHub reference
4. **Channel**: ID, type (Discord/SignalR/Redis/Relay), participants, config, security settings
5. **Capability**: Agent ID, role, platform, tools, languages, resource limits, metadata
6. **Configuration**: Channel settings, retention policy, token, webhook URLs, polling interval

**Relationships**:
- Agent 1:N Messages (sent)
- Agent N:M Tasks (assignments)
- Channel 1:N Agents (participants)
- Channel 1:N Messages (history)
- Task N:M Tasks (dependencies)

**State Transitions**:
- Agent: disconnected → connecting → connected → disconnected
- Task: available → assigned → started → (blocked|in_progress) → (completed|failed)
- Message: queued → sending → sent → delivered → (acknowledged|failed)

### API Contracts (contracts/)

Generate the following contract files:

1. **message-protocol.json**: JSON Schema for message format
   ```json
   {
     "type": "object",
     "required": ["protocolVersion", "messageType", "senderId", "timestamp"],
     "properties": {
       "protocolVersion": { "type": "string", "pattern": "^\\d+\\.\\d+$" },
       "messageType": { "enum": ["task_assigned", "task_started", ...] },
       "senderId": { "type": "string" },
       "recipientId": { "type": "string" },
       "taskId": { "type": "string" },
       "priority": { "type": "integer", "minimum": 0, "maximum": 10 },
       "timestamp": { "type": "string", "format": "date-time" },
       "correlationId": { "type": "string", "format": "uuid" },
       "payload": { "type": "object" }
     }
   }
   ```

2. **capability-schema.json**: Agent capability registration format
3. **mcp-commands.yaml**: MCP command specifications (configure, join, status, etc.)
4. **relay-api.openapi.yaml**: Relay Server REST API specification (if implementing)

### Quickstart Guide (quickstart.md)

Create getting started guide covering:
- Installation (Docker vs npm)
- Configuration (channel setup, GitHub token, etc.)
- First agent connection
- Sample workflows

### Agent Context Update

Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude` to update agent-specific context with technologies from this plan.

---

## Phase 2: Task Decomposition

**Not created by `/speckit.plan`**. Use `/speckit.tasks` command after Phase 1 completion to generate `tasks.md`.

---

## Next Steps

1. ✅ Complete specification (`/speckit.specify` - DONE)
2. ✅ Clarify ambiguities (`/speckit.clarify` - DONE)
3. 🔄 **Current**: Generate implementation plan (`/speckit.plan` - IN PROGRESS)
4. ⏭️ Execute Phase 0 research (research agents)
5. ⏭️ Execute Phase 1 design (data-model.md, contracts/, quickstart.md)
6. ⏭️ Generate tasks (`/speckit.tasks`)
7. ⏭️ Begin implementation (`/speckit.implement`)

**Status**: Plan structure complete. Proceeding to Phase 0 research...
