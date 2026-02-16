# CoorChat v2: Distributed AI Agent Platform

**Specification 002** | Version 0.1 | February 2026

## 1. Executive Summary

CoorChat v2 evolves from a single-machine Slack-based agent coordination tool into a distributed AI development platform. Heterogeneous physical machines — different OSes, architectures, GPUs, and local repository access — each run an AI agent (Claude) that cooperates as part of a coordinated cluster to complete software development tasks.

The key architectural decision is to adopt **Google's A2A (Agent-to-Agent) protocol** for inter-agent coordination and retain **MCP (Model Context Protocol)** for local tool access on each worker. A2A handles horizontal agent-to-agent discovery and messaging; MCP handles vertical tool integration. These are explicitly designed to be complementary and are both governed by the Linux Foundation's Agentic AI Foundation.

### Unique Market Position

Every existing multi-agent coding solution operates on a single machine:

| Solution | Architecture | Limitation |
|---|---|---|
| Claude Code Agent Teams | Single machine, shared filesystem | Cannot span machines |
| oh-my-claudecode | Single machine, multi-session orchestration | No network distribution |
| Devin 2.0 | Cloud VMs, isolated environments | Proprietary, no local hardware |
| claude-flow | Single machine, MCP-based | No cross-machine coordination |

CoorChat v2 would be the first platform combining A2A-standard coordination with cross-machine heterogeneous clusters, purpose-built for software development, with both open-source and commercial deployment options.

---

## 2. Architecture

### 2.1 System Overview

```
                        ┌─────────────────────────┐
                        │      Control Plane       │
                        │    (C# / ASP.NET Core)   │
                        │                          │
                        │  ┌─────────────────────┐ │
                        │  │   A2A Registry       │ │
                        │  │   (Agent Cards)      │ │
                        │  ├─────────────────────┤ │
                        │  │   DAG Scheduler      │ │
                        │  │   (Task Decomp)      │ │
                        │  ├─────────────────────┤ │
                        │  │   Auth (OAuth 2.1)   │ │
                        │  ├─────────────────────┤ │
                        │  │   Monitoring (OTel)  │ │
                        │  └─────────────────────┘ │
                        └──────┬──────────┬────────┘
                               │ A2A      │ A2A
                    ┌──────────┘          └──────────┐
                    ▼                                 ▼
          ┌─────────────────┐               ┌─────────────────┐
          │   Worker Node   │               │   Worker Node   │
          │  (Windows/GPU)  │               │  (Linux/ARM)    │
          │                 │               │                 │
          │  ┌────────────┐ │               │  ┌────────────┐ │
          │  │ Claude API  │ │               │  │ Claude API  │ │
          │  ├────────────┤ │               │  ├────────────┤ │
          │  │ A2A Agent   │ │               │  │ A2A Agent   │ │
          │  ├────────────┤ │               │  ├────────────┤ │
          │  │ MCP Server  │ │               │  │ MCP Server  │ │
          │  │ (v1 TS)     │ │               │  │ (v1 TS)     │ │
          │  └────────────┘ │               │  └────────────┘ │
          │  Local repos,   │               │  Local repos,   │
          │  tools, GPU     │               │  tools           │
          └─────────────────┘               └─────────────────┘
```

### 2.2 Component Roles

#### Control Plane (C# / ASP.NET Core)

The central coordinator. Responsible for:

- **A2A Agent Registry**: Maintains Agent Cards for all workers; supports discovery via well-known URIs and catalog queries
- **Task Decomposition**: Uses LLM planning to break work requests into task DAGs
- **DAG Scheduler**: Schedules tasks to workers based on capabilities, availability, and locality
- **Authentication & Authorization**: OAuth 2.1 per A2A spec; per-skill access control
- **Audit & Compliance**: OpenTelemetry tracing, structured logging, audit trail
- **Dashboard**: Real-time cluster status, task progress, cost tracking (v1 SignalR relay evolves to dashboard-only)

#### Worker Nodes (Cross-platform .NET 10 Console Apps)

Each worker:

- **Publishes an A2A Agent Card** describing machine capabilities (OS, architecture, GPU, available toolchains, local repos)
- **Wraps the Claude API** for task execution
- **Runs a CoorChat v1 MCP Server** (TypeScript/Node.js child process) for local filesystem, git, and build tool access
- **Accepts tasks** via A2A `SendMessage` / `SendStreamingMessage`
- **Reports progress** via A2A task lifecycle events and streaming

### 2.3 Protocol Stack

```
┌────────────────────────────────────────────┐
│              Application Layer             │
│  Task decomposition, scheduling, billing   │
├────────────────────────────────────────────┤
│         A2A Protocol (Horizontal)          │
│  Agent discovery, task delegation,         │
│  streaming, push notifications             │
├────────────────────────────────────────────┤
│         MCP Protocol (Vertical)            │
│  Local tool access: filesystem, git,       │
│  build tools, databases                    │
├────────────────────────────────────────────┤
│            Transport Layer                 │
│  HTTPS/TLS 1.3, JSON-RPC 2.0,             │
│  Server-Sent Events (streaming)            │
└────────────────────────────────────────────┘
```

---

## 3. A2A Protocol Integration

### 3.1 Agent Cards

Each worker publishes an Agent Card at `https://{worker-host}/.well-known/agent-card.json`:

```json
{
  "name": "Phaethon",
  "description": "Windows development agent with GPU acceleration",
  "url": "https://192.168.1.10:8443/a2a",
  "provider": {
    "organization": "CoorChat",
    "url": "https://coorchat.io"
  },
  "version": "2.0.0",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "extendedCard": true
  },
  "skills": [
    {
      "id": "typescript-dev",
      "name": "TypeScript Development",
      "description": "Full-stack TypeScript development with Node.js",
      "inputModes": ["text/plain"],
      "outputModes": ["text/plain", "application/json"]
    },
    {
      "id": "dotnet-dev",
      "name": ".NET Development",
      "description": "C# and .NET application development",
      "inputModes": ["text/plain"],
      "outputModes": ["text/plain"]
    }
  ],
  "security": [
    {
      "scheme": "bearer",
      "bearerFormat": "JWT"
    }
  ],
  "extensions": {
    "coorchat:machine": {
      "platform": "Windows",
      "architecture": "x86_64",
      "gpu": "NVIDIA RTX 4090",
      "memory": "64GB",
      "repos": ["coorchat", "frontend-app", "api-server"],
      "toolchains": ["node-22", "dotnet-10", "python-3.13"]
    }
  }
}
```

The `coorchat:machine` extension carries platform-specific metadata used by the scheduler for capability-based routing.

### 3.2 Task Lifecycle

A2A tasks progress through these states:

```
                    ┌──────────┐
          ┌────────►│ rejected │
          │         └──────────┘
          │
┌─────────┤         ┌──────────────┐         ┌───────────┐
│ created ├────────►│   working    ├────────►│ completed │
└─────────┤         └──────┬───────┘         └───────────┘
          │                │
          │         ┌──────▼───────┐         ┌───────────┐
          │         │input_required│         │  failed   │
          │         └──────┬───────┘         └───────────┘
          │                │                       ▲
          │         ┌──────▼───────┐               │
          └────────►│  canceled    │───────────────┘
                    └──────────────┘
```

**State mappings from v1:**

| v1 TaskStatus | A2A Task State |
|---|---|
| AVAILABLE | (no A2A task yet) |
| ASSIGNED | created |
| STARTED | working |
| IN_PROGRESS | working (with progress artifacts) |
| BLOCKED | input_required |
| COMPLETED | completed |
| FAILED | failed |

### 3.3 A2A Operations Used

| Operation | Usage |
|---|---|
| `SendMessage` | Control plane sends task to worker |
| `SendStreamingMessage` | Worker streams progress back |
| `GetTask` | Control plane polls task status |
| `ListTasks` | Dashboard lists all active tasks |
| `CancelTask` | User cancels a running task |
| `Subscribe` | Dashboard subscribes to real-time updates |
| `PushNotificationConfig` | Workers register webhook endpoints for async results |

### 3.4 .NET SDK Integration

Using the `a2a-dotnet` SDK:

**Control Plane (ASP.NET Core):**
```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddA2A();
var app = builder.Build();

// Register A2A endpoints
app.MapA2A("/a2a");

// Or HTTP-only binding
app.MapHttpA2A("/a2a");
```

**Worker Node:**
```csharp
// Discover control plane
var resolver = new A2ACardResolver();
var controlPlaneCard = await resolver.ResolveAsync("https://control.coorchat.io");

// Send task result
var client = new A2AClient(controlPlaneCard);
await client.SendMessageAsync(new Message
{
    Role = "agent",
    Parts = [new TextPart { Text = taskResult }]
});
```

**Key SDK Types:**
- `A2AClient` — sends requests to remote agents
- `A2ACardResolver` — discovers agent capabilities
- `TaskManager` — orchestrates task lifecycle (server-side)
- `ITaskStore` / `InMemoryTaskStore` — task persistence
- `AgentTask` — task state, history, artifacts
- `AgentCard` — agent identity and capabilities

NuGet packages: `A2A` (core) and `A2A.AspNetCore` (hosting). Targets .NET Standard 2.0 and .NET 8+. Implements A2A protocol v0.2.6.

---

## 4. MCP Integration (Worker Tool Layer)

### 4.1 Role of MCP

Each worker runs the existing CoorChat v1 TypeScript MCP server as a child process. MCP provides:

- **Filesystem access**: Read/write files in local repositories
- **Git operations**: Clone, branch, commit, push, diff
- **Build tools**: npm, dotnet build, pytest, etc.
- **Custom tools**: Database queries, API calls, test runners

### 4.2 MCP Spec (2025-11-25)

Key features from the current MCP specification:

- **Streamable HTTP transport**: Replaces the SSE-only transport; supports polling and resumption
- **OAuth 2.1 authorization**: OpenID Connect Discovery, incremental scope consent
- **Tool annotations**: Metadata describing tool behavior (read-only, destructive, etc.)
- **Output schemas**: Structured tool results with JSON Schema validation
- **Tasks (experimental)**: Durable request tracking with polling — aligns with A2A task model
- **Icons**: Tools, resources, and prompts can declare display icons

### 4.3 Worker MCP Architecture

```
┌─────────────────────────────────────┐
│           .NET Worker Process       │
│                                     │
│  ┌───────────────────────────────┐  │
│  │       Claude API Client       │  │
│  │  (task execution, streaming)  │  │
│  └───────────┬───────────────────┘  │
│              │ tool calls           │
│  ┌───────────▼───────────────────┐  │
│  │      MCP Client (C#)          │  │
│  │  JSON-RPC over stdio          │  │
│  └───────────┬───────────────────┘  │
│              │ stdin/stdout         │
│  ┌───────────▼───────────────────┐  │
│  │   Node.js Child Process       │  │
│  │   (v1 TypeScript MCP Server)  │  │
│  │   - filesystem tools          │  │
│  │   - git tools                 │  │
│  │   - build tools               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

The .NET worker spawns the Node.js MCP server via `Process.Start()`, communicates over stdio using JSON-RPC 2.0, and proxies tool calls from the Claude API. Process lifecycle management includes health checks, restart on crash, and graceful shutdown.

---

## 5. Data Model

### 5.1 Cluster

```
Cluster
├── id: UUID
├── name: string
├── owner: UserId
├── controlPlaneUrl: URL
├── createdAt: DateTime
├── tier: "self-hosted" | "managed" | "hosted" | "marketplace"
└── workers: Worker[]
```

### 5.2 Worker (extends A2A Agent Card)

```
Worker
├── id: UUID
├── agentCard: AgentCard          # Standard A2A card
├── machineInfo:
│   ├── platform: "Linux" | "Windows" | "macOS"
│   ├── architecture: "x86_64" | "arm64"
│   ├── gpu: string?
│   ├── memoryMb: number
│   ├── cpuCores: number
│   └── diskFreeMb: number
├── repos: RepoInfo[]             # Available local repositories
├── toolchains: ToolchainInfo[]   # Installed dev tools
├── status: "online" | "offline" | "busy" | "paused"
├── currentTask: TaskId?
├── lastHeartbeat: DateTime
└── metrics:
    ├── tasksCompleted: number
    ├── tasksFailed: number
    ├── avgDurationMs: number
    └── totalCostUsd: number
```

### 5.3 WorkRequest (User Input)

```
WorkRequest
├── id: UUID
├── description: string           # Natural language task description
├── requestedBy: UserId
├── targetRepo: string?           # Optional: specific repo
├── constraints:
│   ├── maxCostUsd: number?
│   ├── maxDurationMs: number?
│   ├── requiredPlatform: string?
│   └── requiredToolchains: string[]?
├── createdAt: DateTime
├── status: "pending" | "planning" | "executing" | "completed" | "failed"
└── taskDag: TaskDag?             # Generated by planner
```

### 5.4 TaskDag (Decomposed Work)

```
TaskDag
├── id: UUID
├── workRequestId: UUID
├── tasks: TaskNode[]
└── edges: DependencyEdge[]

TaskNode
├── id: UUID
├── description: string
├── requiredCapabilities: string[]
├── assignedWorker: WorkerId?
├── a2aTaskId: string?            # A2A protocol task ID
├── status: A2A TaskState
├── artifacts: Artifact[]
├── estimatedCostUsd: number?
├── actualCostUsd: number?
├── startedAt: DateTime?
├── completedAt: DateTime?
└── error: string?

DependencyEdge
├── from: TaskNodeId               # Must complete before...
└── to: TaskNodeId                 # ...this can start
```

### 5.5 Cost Tracking

```
CostRecord
├── id: UUID
├── taskId: UUID
├── workerId: UUID
├── model: "opus-4.6" | "sonnet-4.5" | "haiku-4.5"
├── inputTokens: number
├── outputTokens: number
├── cachedTokens: number
├── costUsd: number
└── timestamp: DateTime
```

---

## 6. Workflows

### 6.1 Task Execution Flow

```
User submits work request via API/Dashboard
        │
        ▼
Control Plane receives WorkRequest
        │
        ▼
LLM Planner decomposes into TaskDag
  - Analyzes description
  - Identifies sub-tasks and dependencies
  - Estimates required capabilities
        │
        ▼
DAG Scheduler assigns tasks to workers
  - Matches capabilities (OS, toolchains, repos)
  - Considers locality (prefer workers with repo already cloned)
  - Balances load across cluster
        │
        ▼
For each ready task (dependencies met):
  ┌─────────────────────────────────────┐
  │ Control Plane sends A2A SendMessage │
  │ to assigned worker                  │
  └───────────────┬─────────────────────┘
                  │
                  ▼
  ┌─────────────────────────────────────┐
  │ Worker receives task                │
  │ 1. Calls Claude API with task desc  │
  │ 2. Claude uses MCP tools:           │
  │    - Read files, run tests          │
  │    - Edit code, git operations      │
  │ 3. Streams progress via A2A         │
  │ 4. Returns result artifacts         │
  └───────────────┬─────────────────────┘
                  │
                  ▼
  Control Plane marks task complete
  Unblocks dependent tasks
  Repeats until DAG complete
        │
        ▼
WorkRequest marked completed
Cost tallied, audit logged
```

### 6.2 Worker Registration Flow

```
Worker starts up
    │
    ▼
Discovers control plane via configured URL
    │
    ▼
Authenticates via OAuth 2.1
    │
    ▼
Publishes Agent Card to control plane registry
  - Machine capabilities
  - Available skills (toolchains, repos)
    │
    ▼
Starts heartbeat (every 15s)
    │
    ▼
Begins accepting A2A task messages
```

### 6.3 Worker Self-Healing

```
Worker detects MCP server crash
    │
    ▼
Restarts Node.js child process
    │
    ▼
If task was in progress:
  - Re-establishes MCP connection
  - Continues from last known state
  - If unrecoverable: fails task with error

Worker detects Claude API error
    │
    ▼
Retries with exponential backoff (3 attempts)
    │
    ▼
If persistent: marks task failed, notifies control plane
```

---

## 7. Security

### 7.1 Authentication

Per the A2A specification:

- **Transport**: HTTPS with TLS 1.3, strong cipher suites
- **Agent authentication**: OAuth 2.1 with JWT bearer tokens
- **Agent Cards**: Security schemes declared in card; clients authenticate per scheme
- **Scope**: Per-skill access control (e.g., worker X can only execute TypeScript tasks)

### 7.2 Authorization Model

```
Control Plane (OAuth 2.1 Authorization Server)
├── Issues JWT tokens to authenticated workers
├── Scopes:
│   ├── worker:register    - Register as a worker
│   ├── worker:heartbeat   - Send heartbeats
│   ├── task:accept        - Accept task assignments
│   ├── task:report        - Report task results
│   ├── cluster:admin      - Manage cluster settings
│   └── billing:read       - View cost data
└── Per-request validation of JWT claims
```

### 7.3 Network Security

- Workers can be behind NAT; push notifications (webhooks) enable async communication
- Control plane is the only internet-facing component in managed deployments
- Worker-to-worker communication routed through control plane (no direct peer connections in v2.0)
- API keys and secrets stored in platform-native secure storage (Windows DPAPI, macOS Keychain, Linux Secret Service)

### 7.4 Migration from v1

| v1 Mechanism | v2 Replacement |
|---|---|
| Shared token auth | OAuth 2.1 JWT |
| HMAC message signing | TLS 1.3 transport encryption |
| Slack-based commands | A2A protocol messages + REST API |

---

## 8. Observability

### 8.1 OpenTelemetry Integration

The A2A spec mandates W3C Trace Context propagation. CoorChat v2 implements full OpenTelemetry:

**Tracing:**
- Distributed traces across control plane and workers
- Trace context propagated in A2A message headers
- Spans for: task scheduling, A2A messaging, Claude API calls, MCP tool invocations
- NuGet: `OpenTelemetry.Extensions.Hosting`, `OpenTelemetry.Instrumentation.AspNetCore`, `OpenTelemetry.Instrumentation.Http`

**Metrics:**
- Request rates, error rates, latency (per worker, per task type)
- Claude API token usage and cost
- Queue depth, worker utilization
- NuGet: `OpenTelemetry.Exporter.Prometheus`

**Logging:**
- Structured logging via `ILogger<T>` with OTel correlation
- All logs include `taskId`, `workerId`, `traceId`
- NuGet: `OpenTelemetry.Exporter.OpenTelemetryProtocol`

### 8.2 Audit Trail

Per A2A enterprise guidance:
- Task creation, completion, failure events logged with auth context
- Worker registration/deregistration events
- Cost accrual events
- Configuration changes

---

## 9. Tech Stack

### 9.1 Control Plane

| Component | Technology |
|---|---|
| Runtime | .NET 10 (LTS, November 2025 GA) |
| Web framework | ASP.NET Core Minimal APIs |
| A2A hosting | `A2A.AspNetCore` NuGet package (`MapA2A()`) |
| Auth | ASP.NET Core Identity + OAuth 2.1 (IdentityServer / OpenIddict) |
| Database | PostgreSQL (task state, audit log, billing) |
| Cache | Redis (worker heartbeats, session data) |
| Real-time dashboard | SignalR |
| Background jobs | `IHostedService` / .NET `BackgroundService` |
| Observability | OpenTelemetry SDK for .NET |
| API docs | OpenAPI / Swagger (built into ASP.NET Core) |

### 9.2 Worker Node

| Component | Technology |
|---|---|
| Runtime | .NET 10 cross-platform console app |
| A2A client | `A2A` NuGet package |
| Claude integration | Anthropic .NET SDK / HTTP client |
| MCP tool layer | v1 TypeScript MCP server (Node.js child process) |
| Process management | `System.Diagnostics.Process` with health checks |
| Packaging | Single-file publish or Native AOT (per platform) |
| Config | `appsettings.json` + environment variables |

### 9.3 Shared

| Concern | Technology |
|---|---|
| Serialization | System.Text.Json |
| Validation | FluentValidation or DataAnnotations |
| Testing | xUnit + NSubstitute |
| CI/CD | GitHub Actions |
| Container support | Docker (optional, for cloud deployments) |

---

## 10. Commercial Model

### 10.1 Pricing Tiers

| Tier | Description | Price |
|---|---|---|
| **Self-Hosted** | Open source, MIT license. User runs control plane and workers on their own machines. | Free |
| **Managed Cluster** | Hosted control plane, user provides worker machines. Dashboard, auth, scheduling hosted by CoorChat. | GBP 49-199/month |
| **Fully Hosted** | Per-task pricing. CoorChat provides cloud workers. User submits work, pays per task. | GBP 10-50/task |
| **Marketplace** | Developers register idle machines as workers. Earn revenue share on tasks processed. | 70/30 split (worker owner / platform) |

### 10.2 Unit Economics

Based on current Claude API pricing (February 2026):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| Claude Opus 4.6 | $5.00 | $25.00 |
| Claude Sonnet 4.5 | $3.00 | $15.00 |
| Claude Haiku 4.5 | $1.00 | $5.00 |

**Typical task cost analysis:**

| Task Complexity | Model | Est. Tokens (in/out) | API Cost | Charge | Margin |
|---|---|---|---|---|---|
| Simple bug fix | Sonnet | 50K / 10K | ~$0.30 | GBP 10 | ~97% |
| Feature implementation | Opus | 200K / 50K | ~$2.25 | GBP 25 | ~91% |
| Complex refactor | Opus | 500K / 100K | ~$5.00 | GBP 50 | ~90% |

With prompt caching (90% discount on cached tokens) and smart model routing (Haiku for analysis, Opus for implementation), actual costs are significantly lower.

### 10.3 Marketplace Economics

For the marketplace tier:
- Worker owner receives 70% of task fee
- Platform retains 30% for infrastructure, scheduling, billing
- Worker owners pay their own Claude API costs (or platform provides API access at negotiated rates)
- Minimum payout threshold: GBP 50

---

## 11. Migration from v1

### 11.1 What's Retained

| v1 Component | v2 Role |
|---|---|
| TypeScript MCP server | Worker's local tool layer (unchanged) |
| Task/TaskQueue/TaskManager | Conceptual model evolves into DAG scheduler |
| Agent/AgentRegistry | Replaced by A2A Agent Cards + control plane registry |
| SlackChannel | Optional: Slack integration as a UI channel alongside dashboard |
| CommandRegistry | Replaced by REST API + A2A protocol |
| Heartbeat system | Retained concept; implemented via A2A + control plane |

### 11.2 What Changes

| v1 Mechanism | v2 Evolution |
|---|---|
| Slack as primary interface | REST API + web dashboard (Slack as optional notification channel) |
| Single-machine task queue | Distributed DAG scheduler across cluster |
| In-memory state | PostgreSQL persistence |
| `claude --print` execution | Direct Claude API integration with streaming |
| Token-based auth | OAuth 2.1 |
| No inter-agent communication | Full A2A protocol for agent-to-agent messaging |

### 11.3 Migration Path

1. **v1 MCP servers continue working** — no changes needed to existing tool definitions
2. **v1 Slack commands** become optional; REST API provides programmatic equivalent
3. **Workers wrap v1 MCP server** as a child process, gaining all existing tool capabilities
4. **Gradual transition**: can run v1 and v2 side-by-side during migration

---

## 12. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

**Goal:** Control plane skeleton + single worker executing tasks

- [ ] .NET 10 solution structure (control plane + worker projects)
- [ ] A2A Agent Card schema with `coorchat:machine` extension
- [ ] Control plane: `MapA2A()` endpoint, in-memory agent registry
- [ ] Worker: Agent Card publishing, heartbeat, task acceptance
- [ ] Worker: Claude API integration (direct HTTP, not CLI)
- [ ] Worker: MCP server child process management (spawn v1 TS server)
- [ ] Basic REST API for submitting work requests
- [ ] Integration test: submit task, worker executes, returns result

### Phase 2: Scheduling & Persistence (Weeks 5-8)

**Goal:** Multi-worker scheduling with state persistence

- [ ] PostgreSQL schema for tasks, workers, work requests, costs
- [ ] DAG scheduler: capability matching, dependency resolution
- [ ] LLM planner: decompose work request into task DAG
- [ ] Worker selection: locality-aware (prefer worker with repo)
- [ ] Task streaming: A2A `SendStreamingMessage` for progress
- [ ] Cost tracking: token usage per task, per worker
- [ ] Worker reconnection and task recovery

### Phase 3: Security & Dashboard (Weeks 9-12)

**Goal:** Production-ready auth and monitoring

- [ ] OAuth 2.1 authorization server (OpenIddict)
- [ ] JWT-based worker authentication
- [ ] Per-skill authorization scoping
- [ ] OpenTelemetry: tracing, metrics, structured logging
- [ ] Web dashboard: cluster status, task progress, cost reports
- [ ] SignalR real-time updates to dashboard
- [ ] Audit logging to PostgreSQL

### Phase 4: Commercial Features (Weeks 13-16)

**Goal:** Multi-tenant, billing, marketplace foundation

- [ ] Multi-tenant control plane (organization isolation)
- [ ] Billing integration (Stripe)
- [ ] Usage metering and cost allocation
- [ ] Managed cluster tier: hosted control plane provisioning
- [ ] Marketplace: worker registration, task routing, revenue tracking
- [ ] Rate limiting and quota enforcement

### Phase 5: Polish & Launch (Weeks 17-20)

**Goal:** Documentation, testing, beta launch

- [ ] Comprehensive API documentation (OpenAPI)
- [ ] Worker installation guides (Windows, macOS, Linux)
- [ ] Load testing and performance optimization
- [ ] Security audit
- [ ] Beta program with selected users
- [ ] Open source release (self-hosted tier)

---

## 13. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| A2A spec instability (still pre-1.0) | Breaking changes require rework | Medium | Pin to specific protocol version; abstract behind adapter layer |
| A2A .NET SDK immaturity (v0.2.6) | Missing features, bugs | Medium | Contribute upstream; maintain fork if needed; SDK is small enough to replace |
| Claude API cost increases | Margin compression | Low | Smart model routing (Haiku for triage, Opus for execution); batch API; prompt caching |
| Network latency between workers | Slow task handoffs | Low | Workers execute independently; only metadata traverses network |
| Security of worker machines | Compromised worker leaks code | Medium | OAuth scoping; workers only access assigned repos; audit logging |
| Single control plane SPOF | Cluster unavailable | Medium | Phase 4: HA deployment with PostgreSQL replication |
| Slack Socket Mode limitations | Can't support multiple agents per app | Known | v2 moves to A2A; Slack becomes optional notification channel |
| Node.js MCP server crashes | Worker loses tool access | Low | Auto-restart with health checks; tested in v1 |
| Competing products catch up | Market differentiation erodes | Medium | First-mover advantage; open source community; marketplace network effects |

---

## 14. Success Criteria

### Phase 1 (Foundation)
- [ ] Single worker executes task via A2A, returns result
- [ ] Worker publishes Agent Card; control plane discovers it
- [ ] MCP tools (filesystem, git) accessible from worker task execution
- [ ] End-to-end latency < 5s for task dispatch

### Phase 2 (Scheduling)
- [ ] 3+ workers registered, tasks routed by capability
- [ ] Task DAG with dependencies executes correctly
- [ ] Cost tracking accurate to within 5% of actual API spend

### Phase 3 (Production)
- [ ] OAuth 2.1 auth flow complete (worker registration through task execution)
- [ ] Dashboard shows real-time cluster status
- [ ] OpenTelemetry traces visible in Jaeger/Grafana

### Phase 4 (Commercial)
- [ ] Multi-tenant isolation verified (org A cannot see org B's data)
- [ ] Stripe billing integration processes test charges
- [ ] Marketplace worker completes task and receives revenue credit

### Phase 5 (Launch)
- [ ] 10+ beta users running self-hosted clusters
- [ ] < 1% task failure rate (excluding user errors)
- [ ] Documentation covers all installation and usage scenarios

---

## Appendix A: Competitive Analysis

### Claude Code Agent Teams (Anthropic)
- **Architecture**: Single machine, multiple Claude Code sessions coordinated by a "team lead" session
- **Communication**: Shared filesystem, inbox-based messaging between sessions
- **Strengths**: Native Anthropic integration, shared context, automatic dependency tracking
- **Limitations**: Single machine only; all agents share same filesystem; no cross-network distribution
- **Status**: Research preview (February 2026)

### oh-my-claudecode
- **Architecture**: Single machine orchestration layer atop Claude Code
- **Communication**: 32 specialized agents, 7 execution modes (Autopilot, Swarm, Pipeline, etc.)
- **Strengths**: Zero learning curve, automatic parallelization, cost optimization (30-50% token savings)
- **Limitations**: Single machine; all agents same context; no remote workers

### Devin 2.0 (Cognition)
- **Architecture**: Cloud VMs, each Devin instance in isolated environment
- **Strengths**: Multi-agent parallel execution, cloud IDE, enterprise integrations
- **Limitations**: Proprietary cloud-only; cannot use local hardware/GPUs; no self-hosted option; expensive

### claude-flow
- **Architecture**: Single machine, MCP-based agent orchestration
- **Strengths**: Distributed swarm intelligence, RAG integration, native MCP support
- **Limitations**: Single machine only

### CoorChat v2 Differentiation
- **Only solution** enabling cross-machine heterogeneous clusters
- **Only solution** using A2A standard protocol (interoperable with wider ecosystem)
- **Only solution** with both open-source self-hosted and commercial managed tiers
- **Only solution** with marketplace model for idle machine monetization
- **Retains local hardware advantages**: GPUs, fast disk I/O, existing repo clones

---

## Appendix B: A2A Protocol Reference

**Specification**: https://a2a-protocol.org/latest/specification/
**Governance**: Linux Foundation Agentic AI Foundation
**.NET SDK**: https://github.com/a2aproject/a2a-dotnet
**Protocol version**: 0.2.6 (current SDK target)

**Protocol Bindings:**
- JSON-RPC 2.0 (primary): `SendMessage`, `GetTask`, `ListTasks`, `CancelTask`
- gRPC: Service definition with streaming support
- HTTP/REST: `POST /messages`, `GET /tasks/{id}`, query params for filtering

**Error Categories:**
- Authentication errors (401)
- Authorization errors (403)
- Validation errors (400)
- Resource errors (404): `TaskNotFoundError`
- System errors (500)
- A2A-specific: `PushNotificationNotSupportedError`, `UnsupportedOperationError`, `VersionNotSupportedError`

---

## Appendix C: MCP Protocol Reference

**Specification**: https://modelcontextprotocol.io/specification/2025-11-25
**Governance**: Linux Foundation Agentic AI Foundation (same as A2A)
**Current revision**: 2025-11-25

**Key 2025-11-25 changes:**
- Experimental tasks support (durable request tracking with polling)
- OpenID Connect Discovery for auth server discovery
- Incremental scope consent via WWW-Authenticate
- Tool calling in sampling requests
- OAuth Client ID Metadata Documents
- Icons for tools, resources, prompts
- Polling SSE streams

**Transport options:**
- stdio (used by CoorChat v2 workers for local MCP server)
- Streamable HTTP (for remote MCP servers)
