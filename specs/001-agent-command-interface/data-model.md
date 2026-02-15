# Data Model: Agent Command Interface

**Feature**: Agent Command Interface
**Date**: 2026-02-15
**Phase**: Phase 1 - Design

This document defines all entities, their fields, validation rules, and state transitions for the command interface system.

---

## Entity: Command

**Description**: Represents a parsed user instruction from Slack, ready for execution.

### Fields

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `type` | `CommandType` | Yes | Category of command | One of: discovery, communication, queue, config, monitoring, system |
| `name` | `string` | Yes | Specific command name | Lowercase alphanumeric, e.g., "list_agents", "config" |
| `targetAgentId` | `string` | No | Target agent ID if applicable | Pattern: `^[A-Z0-9_-]+$`, e.g., "T14", "agent-001" |
| `params` | `Record<string, unknown>` | Yes | Command-specific parameters | Varies by command type |
| `userId` | `string` | Yes | Slack user ID who issued command | Slack user ID format |
| `channelId` | `string` | Yes | Slack channel ID | Slack channel ID format |
| `timestamp` | `string` | Yes | Command issued time | ISO 8601 datetime |
| `rawText` | `string` | Yes | Original text input | Slack message text |

### TypeScript Definition

```typescript
enum CommandType {
  DISCOVERY = 'discovery',
  COMMUNICATION = 'communication',
  QUEUE = 'queue',
  CONFIG = 'config',
  MONITORING = 'monitoring',
  SYSTEM = 'system',
}

interface Command {
  type: CommandType;
  name: string;
  targetAgentId?: string;
  params: Record<string, unknown>;
  userId: string;
  channelId: string;
  timestamp: string;
  rawText: string;
}
```

### Validation Rules

- **VR-CMD-001**: `name` must match registered command in CommandRegistry
- **VR-CMD-002**: `targetAgentId`, if present, must exist in AgentRegistry
- **VR-CMD-003**: `params` must satisfy command-specific schema (see contracts/)
- **VR-CMD-004**: `timestamp` must be valid ISO 8601 format
- **VR-CMD-005**: `rawText` must not exceed 40,000 characters (Slack limit)

### Example Instances

```typescript
// Discovery command
{
  type: CommandType.DISCOVERY,
  name: 'list_agents',
  params: {},
  userId: 'U0AF26M0VBQ',
  channelId: 'C0AF0RAG8R3',
  timestamp: '2026-02-15T20:00:00.000Z',
  rawText: 'list agents'
}

// Config command
{
  type: CommandType.CONFIG,
  name: 'config',
  targetAgentId: 'T14',
  params: { setting: 'model', value: 'opus' },
  userId: 'U0AF26M0VBQ',
  channelId: 'C0AF0RAG8R3',
  timestamp: '2026-02-15T20:01:00.000Z',
  rawText: 'config T14 model opus'
}
```

---

## Entity: AgentConfig

**Description**: Persistent configuration for an agent, stored in local JSON file.

### Fields

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `agentId` | `string` | Yes | - | Unique agent identifier | Pattern: `^[A-Z0-9_-]+$` |
| `role` | `string` | Yes | 'developer' | Agent's functional role | One of: developer, tester, devops, pm |
| `model` | `string` | No | 'sonnet' | Claude model to use | One of: sonnet, opus, haiku |
| `queueLimit` | `number` | No | 50 | Max tasks in queue | Integer, 1-1000 |
| `status` | `AgentStatus` | No | 'idle' | Current operational status | One of: idle, busy, paused |
| `channelType` | `string` | No | - | Primary channel type | One of: slack, discord, redis, signalr |
| `connectionParams` | `Record<string, unknown>` | No | {} | Channel-specific params | Varies by channel |
| `customSettings` | `Record<string, unknown>` | No | {} | Extension point for future | Any valid JSON |
| `lastUpdated` | `string` | Yes | (auto) | Last modification timestamp | ISO 8601 datetime |

### TypeScript Definition

```typescript
enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  PAUSED = 'paused',
}

interface AgentConfig {
  agentId: string;
  role: 'developer' | 'tester' | 'devops' | 'pm';
  model?: 'sonnet' | 'opus' | 'haiku';
  queueLimit?: number;
  status?: AgentStatus;
  channelType?: 'slack' | 'discord' | 'redis' | 'signalr';
  connectionParams?: Record<string, unknown>;
  customSettings?: Record<string, unknown>;
  lastUpdated: string;
}
```

### Validation Rules

- **VR-CFG-001**: `agentId` must be unique within system
- **VR-CFG-002**: `role` must be one of predefined values
- **VR-CFG-003**: `model` must be valid Claude model name
- **VR-CFG-004**: `queueLimit` must be between 1 and 1000 (inclusive)
- **VR-CFG-005**: `lastUpdated` auto-set on every write

### File Storage

- **Location**: `~/.config/coorchat/config.json` (XDG-compliant, see research.md)
- **Format**: Pretty-printed JSON (2-space indent)
- **Permissions**: 0o600 (user read/write only)
- **Atomicity**: Write-to-temp + atomic rename pattern

### State Transitions

```
idle → busy (when task assigned)
busy → idle (when task completes)
idle → paused (via 'pause' command)
busy → paused (finishes current task first)
paused → idle (via 'resume' command)
```

### Example File

```json
{
  "agentId": "T14",
  "role": "developer",
  "model": "sonnet",
  "queueLimit": 50,
  "status": "idle",
  "channelType": "slack",
  "connectionParams": {
    "channelId": "C0AF0RAG8R3",
    "teamId": "T0AFYGMJ1UG"
  },
  "customSettings": {},
  "lastUpdated": "2026-02-15T20:00:00.000Z"
}
```

---

## Entity: Task

**Description**: Unit of work assigned to an agent, tracked in agent's queue.

### Fields

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `taskId` | `string` | Yes | Unique task identifier | UUID v4 format |
| `description` | `string` | Yes | Human-readable task description | 1-500 characters |
| `priority` | `number` | Yes | Task priority (1=highest, 5=lowest) | Integer, 1-5 |
| `assignedAgentId` | `string` | Yes | Agent responsible for task | Must exist in AgentRegistry |
| `status` | `TaskStatus` | Yes | Current task state | One of: pending, in_progress, completed, cancelled |
| `createdAt` | `string` | Yes | Task creation timestamp | ISO 8601 datetime |
| `startedAt` | `string` | No | When agent started task | ISO 8601 datetime |
| `completedAt` | `string` | No | When task finished | ISO 8601 datetime |
| `createdBy` | `string` | Yes | Slack user ID who created task | Slack user ID format |
| `githubIssue` | `string` | No | Linked GitHub issue | Format: "owner/repo#number" |

### TypeScript Definition

```typescript
enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

interface Task {
  taskId: string;
  description: string;
  priority: number;
  assignedAgentId: string;
  status: TaskStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
  githubIssue?: string;
}
```

### Validation Rules

- **VR-TSK-001**: `taskId` must be unique across all agents
- **VR-TSK-002**: `description` must be 1-500 characters
- **VR-TSK-003**: `priority` must be 1-5 (inclusive)
- **VR-TSK-004**: `assignedAgentId` must exist in registry
- **VR-TSK-005**: Status transitions must follow state machine (see below)
- **VR-TSK-006**: `completedAt` requires `startedAt` to be set
- **VR-TSK-007**: Queue depth per agent must not exceed `AgentConfig.queueLimit`

### State Transitions

```
pending → in_progress (agent starts work)
in_progress → completed (successful finish)
in_progress → cancelled (explicit cancel)
pending → cancelled (cancel before start)
```

**Invalid transitions**:
- `completed` → any (terminal state)
- `cancelled` → any (terminal state)

### Example Instance

```typescript
{
  taskId: '550e8400-e29b-41d4-a716-446655440000',
  description: 'Investigate memory leak in SignalR hub',
  priority: 2,
  assignedAgentId: 'T14',
  status: TaskStatus.PENDING,
  createdAt: '2026-02-15T20:00:00.000Z',
  createdBy: 'U0AF26M0VBQ',
  githubIssue: 'StuartF303/coorchat#42'
}
```

---

## Entity: CommandResponse

**Description**: Structured response sent back to Slack after command execution.

### Fields

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `success` | `boolean` | Yes | Whether command succeeded | - |
| `message` | `string` | Yes | Human-readable response | 1-40,000 characters |
| `data` | `unknown` | No | Structured data for formatting | Valid JSON |
| `timestamp` | `string` | Yes | Response generation time | ISO 8601 datetime |
| `commandId` | `string` | No | Reference to original command | UUID v4 |
| `errorCode` | `string` | No | Machine-readable error code | Uppercase snake_case |

### TypeScript Definition

```typescript
interface CommandResponse {
  success: boolean;
  message: string;
  data?: unknown;
  timestamp: string;
  commandId?: string;
  errorCode?: string;
}
```

### Validation Rules

- **VR-RSP-001**: `message` must not exceed Slack's 40,000 char limit
- **VR-RSP-002**: `errorCode` required if `success === false`
- **VR-RSP-003**: `data` must be JSON-serializable
- **VR-RSP-004**: `timestamp` must be valid ISO 8601

### Error Codes

| Code | Description | User Action |
|------|-------------|-------------|
| `AGENT_NOT_FOUND` | Target agent doesn't exist | Check agent ID with 'list agents' |
| `QUEUE_FULL` | Agent queue at capacity | Increase limit or wait |
| `INVALID_MODEL` | Model name not recognized | Use sonnet, opus, or haiku |
| `INVALID_PRIORITY` | Priority out of range | Use 1-5 or high/medium/low |
| `TASK_NOT_FOUND` | Task ID doesn't exist | Check task ID with 'tasks' |
| `AGENT_TIMEOUT` | Agent didn't respond in 30s | Agent may be disconnected |
| `PERMISSION_DENIED` | User not authorized | Contact admin |

### Example Instances

```typescript
// Success response
{
  success: true,
  message: 'Agent T14 model changed to opus',
  data: { agentId: 'T14', model: 'opus', previousModel: 'sonnet' },
  timestamp: '2026-02-15T20:00:00.000Z',
  commandId: '123e4567-e89b-12d3-a456-426655440000'
}

// Error response
{
  success: false,
  message: 'Agent T99 not found. Use "list agents" to see connected agents.',
  errorCode: 'AGENT_NOT_FOUND',
  timestamp: '2026-02-15T20:00:00.000Z',
  commandId: '123e4567-e89b-12d3-a456-426655440000'
}
```

---

## Entity: TaskMetrics

**Description**: Performance and completion statistics for an agent, tracked in-memory and persisted to file.

### Fields

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `agentId` | `string` | Yes | Agent these metrics belong to | Must exist |
| `totalTasks` | `number` | Yes | Total tasks received | Non-negative integer |
| `completedTasks` | `number` | Yes | Successfully completed tasks | ≤ totalTasks |
| `failedTasks` | `number` | Yes | Failed tasks | ≤ totalTasks |
| `cancelledTasks` | `number` | Yes | Cancelled tasks | ≤ totalTasks |
| `averageCompletionTime` | `number` | Yes | Avg time to complete (ms) | Non-negative float |
| `uptime` | `number` | Yes | Agent uptime (seconds) | Non-negative integer |
| `lastTaskTimestamp` | `string` | No | When last task completed | ISO 8601 datetime |
| `collectedAt` | `string` | Yes | When metrics were collected | ISO 8601 datetime |

### TypeScript Definition

```typescript
interface TaskMetrics {
  agentId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  averageCompletionTime: number;
  uptime: number;
  lastTaskTimestamp?: string;
  collectedAt: string;
}
```

### Validation Rules

- **VR-MET-001**: `completedTasks + failedTasks + cancelledTasks ≤ totalTasks`
- **VR-MET-002**: `averageCompletionTime` only meaningful if `completedTasks > 0`
- **VR-MET-003**: Persist to `~/.config/coorchat/metrics.json` on update

### Derived Fields (Computed)

```typescript
interface DerivedMetrics {
  successRate: number;        // completedTasks / totalTasks
  pendingTasks: number;        // totalTasks - (completed + failed + cancelled)
  failureRate: number;         // failedTasks / totalTasks
  tasksPerHour: number;        // completedTasks / (uptime / 3600)
}
```

### Example Instance

```typescript
{
  agentId: 'T14',
  totalTasks: 100,
  completedTasks: 85,
  failedTasks: 10,
  cancelledTasks: 5,
  averageCompletionTime: 125000,  // 125 seconds
  uptime: 86400,  // 24 hours
  lastTaskTimestamp: '2026-02-15T19:55:00.000Z',
  collectedAt: '2026-02-15T20:00:00.000Z'
}

// Derived
{
  successRate: 0.85,
  pendingTasks: 0,
  failureRate: 0.10,
  tasksPerHour: 3.54
}
```

---

## Relationships

### Command → AgentConfig
- Command.targetAgentId → AgentConfig.agentId (optional FK)
- One command may target zero or one agent

### Task → AgentConfig
- Task.assignedAgentId → AgentConfig.agentId (required FK)
- One agent has many tasks

### TaskMetrics → AgentConfig
- TaskMetrics.agentId → AgentConfig.agentId (required FK, 1:1)
- One agent has one metrics record

### CommandResponse → Command
- CommandResponse.commandId → Command.id (optional reference)
- One command produces one response

---

## Storage Summary

| Entity | Storage | Format | Persistence |
|--------|---------|--------|-------------|
| Command | In-memory only | TypeScript object | No (transient) |
| AgentConfig | Local file | JSON | Yes (atomic writes) |
| Task | Agent memory + relay server | TypeScript object | Session-only |
| CommandResponse | Slack API | Message blocks | Slack history |
| TaskMetrics | Local file | JSON | Yes (periodic writes) |

---

## Validation Layer

All entities use **Zod** for runtime validation:

```typescript
import { z } from 'zod';

const AgentConfigSchema = z.object({
  agentId: z.string().regex(/^[A-Z0-9_-]+$/),
  role: z.enum(['developer', 'tester', 'devops', 'pm']),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
  queueLimit: z.number().int().min(1).max(1000).optional(),
  status: z.enum(['idle', 'busy', 'paused']).optional(),
  lastUpdated: z.string().datetime(),
});

// Usage
const config = AgentConfigSchema.parse(jsonData);
```

---

## Next Steps

- Create command schemas in `contracts/commands.schema.json`
- Implement entity classes in `src/commands/types.ts`
- Add validation helpers in `src/commands/validation.ts`
