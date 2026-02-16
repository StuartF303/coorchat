# CoorChat

Multi-agent coordination platform enabling specialized AI agents (developers, testers, architects, etc.) to collaborate on software development tasks through secure, real-time communication channels. Agents coordinate via Redis pub/sub, Discord, Slack Socket Mode, or a .NET SignalR relay server.

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Node.js | 18+ | MCP server runtime (ES modules) |
| Language | TypeScript | 5.x | Strict mode, ES2022 target |
| Relay Server | ASP.NET Core | 8.x | Optional SignalR hub for distributed teams |
| Database | PostgreSQL | 16.x | Relay server persistence (via EF Core) |
| Validation | Zod + AJV | 3.x / 8.x | Schema validation (config + messages) |
| Logging | Winston | 3.x | Structured JSON logging |
| Testing | Vitest | 1.x | Unit + integration tests |
| CI/CD | GitHub Actions | - | Lint, test, build, Docker, publish |

## Quick Start

```bash
# Prerequisites: Node.js 18+, Docker (optional, for Redis)

# Clone and install
git clone https://github.com/stuartf303/coorchat.git
cd coorchat/packages/mcp-server
npm install
npm run build

# Generate secure token
npm run cli -- token generate

# Start Redis (optional)
docker run -d --name coorchat-redis -p 6379:6379 redis:7-alpine

# Configure environment
cp .env.example .env  # Then edit with your tokens

# Run tests
npm test

# Start an agent
npm run cli -- agent start --role developer
```

## Project Structure

```
coorchat/
├── packages/
│   ├── mcp-server/                    # TypeScript MCP coordination server
│   │   ├── src/
│   │   │   ├── index.ts               # Entry point
│   │   │   ├── agents/                # Agent registry, roles, capabilities
│   │   │   │   ├── Agent.ts           # Agent interface & AgentStatus enum
│   │   │   │   ├── AgentRegistry.ts   # Central agent registry (Map-based)
│   │   │   │   ├── Capability.ts      # Agent capability model
│   │   │   │   └── RoleManager.ts     # Role definitions & matching
│   │   │   ├── channels/              # Communication channel adapters
│   │   │   │   ├── base/              # Channel interface, ChannelAdapter base, ChannelFactory
│   │   │   │   ├── discord/           # Discord.js integration
│   │   │   │   ├── redis/             # Redis pub/sub (ioredis)
│   │   │   │   ├── signalr/           # @microsoft/signalr client
│   │   │   │   ├── slack/             # Slack Socket Mode + Web API
│   │   │   │   └── relay/             # Relay server support
│   │   │   ├── commands/              # Slack command interface
│   │   │   │   ├── CommandParser.ts   # Natural language command parsing
│   │   │   │   ├── CommandRegistry.ts # Command registration & dispatch
│   │   │   │   ├── types.ts           # Command type definitions
│   │   │   │   ├── formatters/        # ResponseBuilder, SlackFormatter
│   │   │   │   └── handlers/          # Discovery, Communication, Queue, etc.
│   │   │   ├── config/                # ConfigLoader, ConfigValidator, EnvironmentResolver, TokenGenerator
│   │   │   ├── github/                # GitHubClient, PollingService, SyncManager, WebhookHandler
│   │   │   ├── logging/               # Logger (Winston), LogFormatter
│   │   │   ├── protocol/              # Message types, MessageBuilder, MessageValidator, VersionManager
│   │   │   ├── tasks/                 # Task, TaskManager, TaskQueue, DependencyTracker, ConflictResolver
│   │   │   └── cli/                   # CLI entry point, CommandHandler
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── channels/          # DiscordChannel, RedisChannel, SignalRChannel, SlackChannel
│   │   │   │   └── commands/          # All command handler tests
│   │   │   ├── integration/           # agent-task-coordination, command-interface, secure-communication
│   │   │   └── signalr-integration-test.ts
│   │   ├── .env.example               # Environment variable template
│   │   └── package.json
│   │
│   └── relay-server/                  # C# ASP.NET Core SignalR relay
│       ├── src/
│       │   ├── CoorChat.RelayServer.Api/       # SignalR hub, auth middleware
│       │   ├── CoorChat.RelayServer.Core/      # Models, services, interfaces
│       │   └── CoorChat.RelayServer.Data/      # EF Core + PostgreSQL
│       ├── tests/
│       │   ├── CoorChat.RelayServer.Tests.Unit/
│       │   └── CoorChat.RelayServer.Tests.Integration/
│       └── CoorChat.RelayServer.sln
│
├── specs/                             # Feature specifications (Specify workflow)
│   ├── 001-multi-agent-coordination/  # Core coordination spec, plan, data model, contracts
│   └── 001-agent-command-interface/   # Slack command interface spec
│
├── .github/workflows/
│   ├── mcp-server-ci.yml             # TS: lint → test → build → Docker → npm publish
│   └── relay-server-ci.yml           # C#: build → test → Docker → NuGet publish
│
├── docker-compose.yml                 # mcp-server + redis services
├── quick-start.sh / quick-start.ps1   # Automated setup scripts
└── CLAUDE.md                          # This file
```

## Architecture Overview

CoorChat is a **monorepo** with two packages. The **MCP server** (TypeScript) is the primary coordination client that integrates with Claude Desktop via the MCP protocol. It manages agent registration, task assignment, messaging, and GitHub issue sync. The **relay server** (C#/.NET) is an optional enterprise-grade SignalR hub for distributed teams.

Agents communicate through pluggable **channel adapters** (Redis, Discord, Slack, SignalR) that implement a common `Channel` interface. The `ChannelFactory` creates adapters based on config. Messages follow a versioned protocol with HMAC-SHA256 signing for integrity.

```
GitHub Issues/PRs ──► SyncManager ──► TaskQueue (priority + dependencies)
                                          │
                           ┌──────────────┼──────────────┐
                           ▼              ▼              ▼
                        Agent 1        Agent 2        Agent 3
                           └──────────────┼──────────────┘
                                          ▼
                              Channel Layer (Redis/Discord/Slack/SignalR)
```

### Key Modules

| Module | Location | Purpose |
|--------|----------|---------|
| ChannelAdapter | `src/channels/base/` | Abstract base class for all channel implementations. Uses Set-based handler management (not EventEmitter). |
| AgentRegistry | `src/agents/` | Thread-safe agent registry with role-based lookup and capability matching. |
| TaskManager | `src/tasks/` | Task lifecycle (assign → start → progress → complete), priority queue, dependency tracking with cycle detection. |
| CommandParser | `src/commands/` | Natural language command parsing for Slack interface. Case-insensitive. |
| MessageBuilder | `src/protocol/` | Builder pattern for constructing validated protocol messages. |
| ConfigValidator | `src/config/` | Zod-based config validation with environment variable resolution. |

## Available Commands

### MCP Server (TypeScript)

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript (`tsc && tsc-alias`) |
| `npm run dev` | Start dev server with hot reload (`tsx watch`) |
| `npm start` | Run compiled production build |
| `npm test` | Run Vitest test suite (watch mode) |
| `npm test -- --run` | Run tests once (no watch) |
| `npm run test:integration` | Run integration tests only |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | ESLint on `src/` |
| `npm run format` | Prettier on `src/**/*.ts` |
| `npm run cli -- <command>` | CLI tool (token, agent, role, config, monitor) |

### Relay Server (C#)

| Command | Description |
|---------|-------------|
| `dotnet build` | Build the solution |
| `dotnet test` | Run all C# tests |
| `dotnet run --project src/CoorChat.RelayServer.Api` | Start relay server |

## Development Guidelines

### File Naming
- Source files: **PascalCase** matching the primary export (`AgentRegistry.ts`, `SlackChannel.ts`, `TaskQueue.ts`)
- Test files: **PascalCase** with `.test.ts` suffix (`DiscordChannel.test.ts`, `CommandParser.test.ts`)
- Tests mirror source structure under `tests/unit/` and `tests/integration/`

### Code Naming
- **Classes/Interfaces**: PascalCase (`AgentRegistry`, `Channel`, `TaskManager`)
- **Functions/methods**: camelCase with verb prefix (`getById()`, `validateAgent()`, `createLogger()`)
- **Variables/properties**: camelCase (`agentRegistry`, `messageHandlers`)
- **Private properties**: underscore prefix (`_status`, `_level`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PROTOCOL_VERSION`, `DEFAULT_PRIORITY`)
- **Enums**: PascalCase names, PascalCase members (`AgentStatus.CONNECTED`, `MessageType.TASK_ASSIGNED`)
- **Booleans**: `is`/`has`/`can`/`enable` prefix (`isConnected`, `hasPlaceholders`, `enableTimeoutChecking`)
- **Types**: PascalCase; use `interface` for object contracts, `type` for callbacks/unions

### Import Conventions
- ES module imports with **`.js` extensions** (required for Node.js ESM)
- Order: stdlib → third-party → type imports → local imports
- Path aliases: `@/*` maps to `./src/*` (via tsconfig paths + tsc-alias)

### Key Patterns
- **Base class + abstract methods**: `ChannelAdapter` defines `doConnect()` / `doDisconnect()` for subclasses
- **Registry pattern**: `AgentRegistry` with `Map<string, Agent>` for O(1) lookups
- **Builder pattern**: `MessageBuilder.type().from().to().payload().build()`
- **Factory pattern**: `ChannelFactory.create(config)` for channel instantiation
- **Event handlers via Sets**: `onMessage()` returns an unregister function `() => void`
- **Zod schemas → types**: `export const Schema = z.object({...})` then `export type T = z.output<typeof Schema>`
- **Error handling**: Always `error instanceof Error ? error.message : String(error)`
- **Constructor injection**: Optional config objects with defaults (`config: Options = {}`)
- **Singletons**: `export const logger = createLogger()`, `export const validator = new ConfigValidator()`

### TypeScript Configuration
- `strict: true` with `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
- Target: ES2022, Module: ESNext
- Source maps enabled, declarations generated

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | For Slack | Slack bot token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | For Slack | Slack app token (`xapp-...`) |
| `SLACK_CHANNEL_ID` | For Slack | Target Slack channel ID |
| `SHARED_TOKEN` | Yes | Authentication token (generate via CLI) |
| `CHANNEL_TYPE` | No | `redis`, `discord`, `slack`, or `signalr` |
| `REDIS_HOST` | For Redis | Redis host (default: `localhost`) |
| `REDIS_PORT` | For Redis | Redis port (default: `6379`) |
| `DISCORD_BOT_TOKEN` | For Discord | Discord bot token |
| `SIGNALR_HUB_URL` | For SignalR | SignalR hub URL (e.g., `https://localhost:5001/agentHub`) |
| `AGENT_ID` | No | Agent identifier |
| `AGENT_ROLE` | No | Agent role (`developer`, `tester`, `architect`, etc.) |
| `LOG_LEVEL` | No | Logging level (default: `info`) |
| `NODE_ENV` | No | Environment (`development`, `production`) |

## Testing

- **Unit tests**: `tests/unit/` — Channel adapters, command handlers. Use Vitest with `vi.mock()` for dependencies.
- **Integration tests**: `tests/integration/` — Agent-task coordination (10 tests), secure communication (24 tests), command interface.
- **SignalR integration**: `tests/signalr-integration-test.ts` — Full 16-test suite against running relay server.
- **C# tests**: `packages/relay-server/tests/` — Unit and integration test projects.

### Testing Notes
- ChannelAdapter uses **Set-based handler management**, not EventEmitter. Use `onMessage()` / `onError()` / `onConnectionStateChange()`.
- Message types use **snake_case string values** at runtime (e.g., `'task_assigned'`), not the enum names.
- Always `await channel.connect()` before testing channel operations.
- Add small delays (`await new Promise(r => setTimeout(r, 100))`) for async event propagation in tests.

## Slack Command Interface

All commands are case-insensitive. See @packages/mcp-server/CLI.md for full CLI reference and @packages/mcp-server/SLACK_SETUP.md for Slack setup.

| Category | Commands |
|----------|----------|
| Discovery | `list agents`, `status`, `status <id>`, `ping all` |
| Messaging | `@<id> <msg>`, `broadcast <msg>`, `ask <id> <msg>` |
| Queue | `queue <id>`, `tasks`, `cancel <task-id>`, `assign <id> <task>`, `priority <task-id> <level>` |
| Config | `config <id> model|role|queue-limit <val>`, `config <id> show`, `pause|resume <id>` |
| Monitoring | `logs <id> [n]`, `metrics <id>`, `errors`, `history <id>` |
| System | `help`, `version`, `restart <id>`, `shutdown <id>` |

## Additional Resources

- @README.md — Full project overview and examples
- @INSTALL.md — Complete installation guide for all platforms
- @SCENARIOS.md — Real-world coordination workflow examples
- @SECURITY.md — Security policy and vulnerability reporting
- @CONTRIBUTING.md — Contribution guidelines (Specify workflow)
- @specs/ — Feature specifications, plans, and API contracts

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->


## Skill Usage Guide

When working on tasks involving these technologies, invoke the corresponding skill:

| Skill | Invoke When |
|-------|-------------|
| csharp | Develops ASP.NET Core 8.0 relay server with SignalR and EF Core |
| aspnet | Builds SignalR hubs, authentication middleware, and HTTP endpoints |
| vitest | Configures unit and integration tests with mocking and coverage |
| node | Manages Node.js 18+ runtime, ES modules, and MCP server execution |
| typescript | Enforces strict TypeScript patterns, ES2022 target, and type safety |
| signalr | Implements real-time bidirectional communication and hub methods |
| discord | Integrates Discord.js bot tokens, channels, and message handlers |
| slack | Sets up Slack Socket Mode, Web API, and command parsing |
| redis | Configures pub/sub messaging, connection pooling, and HMAC signing |
| postgresql | Designs EF Core schemas, migrations, and relay server persistence |
| zod | Validates configuration schemas and message protocols |
| winston | Structures JSON logging with levels and transports |
| github-api | Syncs issues/PRs via webhooks and polling with octokit/rest |
| docker | Builds containerized services for MCP server and relay server |
| github-actions | Configures CI/CD pipelines for testing, linting, and publishing |
