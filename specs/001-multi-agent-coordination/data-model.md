# Data Model: Multi-Agent Coordination System

**Feature**: 001-multi-agent-coordination
**Date**: 2026-02-14
**Status**: Phase 1 Design

## Overview

This document defines the data entities, relationships, state transitions, and validation rules for the Multi-Agent Coordination System.

---

## Core Entities

### 1. Agent

Represents a specialized AI agent participating in coordination.

**Attributes**:
- `id` (string, UUID): Unique agent identifier
- `role` (string): Agent role type (extensible: developer, tester, architect, custom roles)
- `platform` (enum): Operating system (Linux | macOS | Windows)
- `environment` (string): Execution environment (local, GitHub Actions, Azure DevOps, AWS, etc.)
- `capabilities` (Capability): Agent capability set (see Capability entity)
- `status` (enum): Connection status (disconnected | connecting | connected)
- `currentTask` (string, optional): ID of currently assigned task
- `registeredAt` (timestamp): When agent joined the channel
- `lastSeenAt` (timestamp): Last activity timestamp

**Validation Rules**:
- `id`: Must be UUID v4 format
- `role`: Non-empty string, max 50 characters
- `platform`: Must be one of defined enum values
- `environment`: Non-empty string, max 100 characters
- `status`: Must be valid enum value
- `registeredAt`, `lastSeenAt`: ISO 8601 timestamp

**State Transitions**:
```
disconnected → connecting → connected → disconnected
         ↑                      ↓
         └──────────────────────┘
         (reconnection)
```

**Lifecycle**:
1. **Registration**: Agent sends capability registration message
2. **Connected**: Agent receives acknowledgment, can send/receive messages
3. **Active**: Agent claims tasks, sends status updates
4. **Disconnected**: Agent explicitly disconnects or times out (30s no heartbeat)

---

### 2. Message

Represents a structured communication between agents.

**Attributes**:
- `protocolVersion` (string): Semantic version (e.g., "1.0")
- `messageType` (enum): Message category
  - `task_assigned`, `task_started`, `task_blocked`, `task_progress`, `task_completed`, `task_failed`
  - `capability_query`, `capability_response`
  - `status_query`, `status_response`
  - `error`
- `senderId` (string, UUID): Sending agent ID
- `recipientId` (string, UUID, optional): Recipient agent ID (null for broadcast)
- `taskId` (string, UUID, optional): Associated task ID (if applicable)
- `priority` (integer): Message priority (0-10, default 5)
- `timestamp` (timestamp): Message creation time
- `correlationId` (string, UUID, optional): For request/response matching
- `payload` (object): Message-specific data
- `deliveryStatus` (enum): queued | sending | sent | delivered | acknowledged | failed

**Validation Rules**:
- `protocolVersion`: Must match pattern `^\d+\.\d+$`
- `messageType`: Must be valid enum value
- `senderId`: Must be valid UUID
- `recipientId`: If present, must be valid UUID
- `taskId`: If present, must be valid UUID
- `priority`: Integer 0-10
- `timestamp`: ISO 8601 timestamp
- `correlationId`: If present, must be valid UUID
- `payload`: Valid JSON object

**State Transitions**:
```
queued → sending → sent → delivered → acknowledged
            ↓
          failed
```

**Message Types & Payloads**:

```typescript
// task_assigned
payload: {
  taskId: string;
  description: string;
  dependencies: string[];
  githubIssue: string; // Issue URL
}

// task_started
payload: {
  taskId: string;
  estimatedCompletionTime: timestamp;
}

// task_progress
payload: {
  taskId: string;
  percentComplete: number; // 0-100
  status: string;
}

// task_completed
payload: {
  taskId: string;
  result: object; // Task-specific result data
  githubPR: string; // PR URL if applicable
}

// task_failed
payload: {
  taskId: string;
  error: string;
  retryable: boolean;
}

// capability_query
payload: {
  // Empty or specific capability filter
}

// capability_response
payload: {
  capabilities: Capability; // See Capability entity
}

// status_query
payload: {
  agentId: string; // Query specific agent or broadcast
}

// status_response
payload: {
  currentTask: string | null;
  status: string;
  uptime: number; // seconds
}

// error
payload: {
  code: string;
  message: string;
  details: object;
}
```

---

### 3. Task

Represents a work item from GitHub repository.

**Attributes**:
- `id` (string, UUID): Unique task identifier
- `description` (string): Task description
- `assignedAgents` (string[]): Array of assigned agent IDs
- `status` (enum): Task state (available | assigned | started | in_progress | blocked | completed | failed)
- `dependencies` (string[]): Array of task IDs this task depends on
- `githubIssueId` (string): GitHub issue number
- `githubIssueUrl` (string): Full GitHub issue URL
- `githubPRUrl` (string, optional): Associated PR URL
- `createdAt` (timestamp): When task was created
- `assignedAt` (timestamp, optional): When task was assigned
- `startedAt` (timestamp, optional): When work started
- `completedAt` (timestamp, optional): When work finished
- `claimedAt` (timestamp, optional): Timestamp for conflict resolution

**Validation Rules**:
- `id`: UUID v4
- `description`: Non-empty, max 500 characters
- `assignedAgents`: Array of valid UUIDs
- `status`: Valid enum value
- `dependencies`: Array of valid task UUIDs
- `githubIssueId`: Integer as string
- `githubIssueUrl`: Valid URL
- All timestamps: ISO 8601

**State Transitions**:
```
available → assigned → started → in_progress → completed
                  ↓         ↓           ↓
                  └─→ blocked ←─────────┘
                                ↓
                             failed
```

**Conflict Resolution**:
When multiple agents claim same task simultaneously:
1. Compare `claimedAt` timestamps
2. Agent with earliest timestamp wins
3. Other agents receive `task_unavailable` error
4. Implement idempotency: deduplicate by correlation ID

---

### 4. Channel

Represents the coordination communication space.

**Attributes**:
- `id` (string, UUID): Channel identifier
- `type` (enum): Channel type (discord | signalr | redis | relay)
- `name` (string): Human-readable channel name
- `participants` (string[]): Array of connected agent IDs
- `config` (ChannelConfig): Channel-specific configuration
- `securitySettings` (SecuritySettings): Auth token, encryption settings
- `messageHistory` (boolean): Whether history is persisted
- `retentionDays` (integer): Message retention period (configured at init)
- `createdAt` (timestamp): Channel creation time
- `createdBy` (string): User/admin who created channel

**Validation Rules**:
- `id`: UUID v4
- `type`: Valid enum value
- `name`: Non-empty, max 100 characters
- `participants`: Array of valid UUIDs
- `retentionDays`: Positive integer
- `createdAt`: ISO 8601 timestamp

**Channel-Specific Config**:

```typescript
// Discord
DiscordConfig: {
  guildId: string;
  channelId: string;
  botToken: string; // Encrypted
}

// SignalR
SignalRConfig: {
  hubUrl: string;
  accessToken: string; // Encrypted
}

// Redis
RedisConfig: {
  host: string;
  port: number;
  password: string; // Encrypted
  db: number;
  channelName: string; // Redis pub/sub channel
}

// Relay
RelayConfig: {
  serverUrl: string;
  channelId: string;
  accessToken: string; // Encrypted
}
```

**Security Settings**:
```typescript
SecuritySettings: {
  sharedToken: string; // Self-generated, encrypted at rest
  encryptionEnabled: boolean;
  allowedAgentRoles: string[]; // Role-based access control
}
```

---

### 5. Capability

Represents an agent's declared capabilities.

**Attributes**:
- `agentId` (string, UUID): Associated agent ID
- `roleType` (string): Agent role (extensible)
- `platform` (string): OS platform
- `environmentType` (string): Execution environment
- `tools` (string[]): Available commands/APIs
- `languages` (string[]): Supported programming languages
- `apiAccess` (string[]): External APIs agent can call
- `resourceLimits` (ResourceLimits): Quota/rate limit info
- `customMetadata` (object): Custom capability fields

**Validation Rules**:
- `agentId`: Valid UUID
- `roleType`: Non-empty string, max 50 characters
- Arrays: Non-empty, each item max 100 characters
- `resourceLimits`: Valid ResourceLimits object

**Resource Limits**:
```typescript
ResourceLimits: {
  apiQuotaPerHour: number; // Max API calls per hour
  maxConcurrentTasks: number; // Max simultaneous tasks
  rateLimitPerMinute: number; // Max requests per minute
  memoryLimitMB: number; // Memory constraint
}
```

---

### 6. Configuration

Represents system configuration (stored in local JSON/YAML files).

**Attributes**:
- `version` (string): Config schema version
- `channel` (ChannelSettings): Channel configuration
- `github` (GitHubSettings): GitHub integration settings
- `logging` (LoggingSettings): Log level and outputs
- `advanced` (AdvancedSettings): Optional advanced settings

**Validation Rules**:
- All settings validated by Zod schema
- Environment variable substitution: `${VAR_NAME}` syntax
- Secrets must use environment variables (not hardcoded)

**Configuration Schema**:

```typescript
Configuration: {
  version: "1.0",
  channel: {
    type: "discord" | "signalr" | "redis" | "relay",
    config: ChannelConfig, // Type-specific config
    retentionDays: number,
    token: string, // Can be ${CHANNEL_TOKEN}
  },
  github: {
    token: string, // ${GITHUB_TOKEN}
    repositoryUrl: string,
    webhookSecret: string | null,
    pollingIntervalSeconds: number, // Default: 30
  },
  logging: {
    level: "ERROR" | "WARN" | "INFO" | "DEBUG",
    outputs: ("console" | "file")[],
    filePath: string | null,
  },
  advanced: {
    maxRetries: number, // Default: 5
    connectionTimeoutMs: number, // Default: 30000
    heartbeatIntervalMs: number, // Default: 15000
  }
}
```

---

## Relationships

### Entity Relationship Diagram

```
┌─────────┐
│ Channel │
└────┬────┘
     │ 1:N
     │
┌────┴────┐
│  Agent  │───────────┐
└────┬────┘           │
     │ 1:N            │ N:M
     │                │
┌────┴─────┐     ┌───┴────┐
│ Message  │     │  Task  │
└──────────┘     └───┬────┘
                     │ N:M (dependencies)
                     └─────┐
                           │
                      ┌────┴────┐
                      │  Task   │
                      └─────────┘

┌──────────────┐
│ Capability   │
└──────┬───────┘
       │ 1:1
       │
   ┌───┴───┐
   │ Agent │
   └───────┘

┌────────────────┐
│ Configuration  │  (File-based, not in database)
└────────────────┘
```

### Cardinality

- **Channel ↔ Agent**: 1:N (one channel, many agents)
- **Agent ↔ Message**: 1:N (one agent sends many messages)
- **Agent ↔ Task**: N:M (agents can have multiple tasks, tasks can have multiple agents)
- **Task ↔ Task**: N:M (task dependencies)
- **Agent ↔ Capability**: 1:1 (each agent has one capability set)
- **Channel ↔ Message**: 1:N (one channel, many messages in history)

---

## Indexes & Performance

### Recommended Database Indexes

For Relay Server (PostgreSQL):

```sql
-- Messages
CREATE INDEX idx_messages_channel_timestamp ON messages(channel_id, timestamp DESC);
CREATE INDEX idx_messages_timestamp ON messages(timestamp); -- For retention purge
CREATE INDEX idx_messages_task_id ON messages(task_id) WHERE task_id IS NOT NULL;

-- Agents
CREATE INDEX idx_agents_channel_status ON agents(channel_id, status);
CREATE INDEX idx_agents_role ON agents(role);

-- Tasks
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_agents ON tasks USING GIN(assigned_agents); -- Array index
```

### Caching Strategy

- **Agent Capabilities**: Cache in-memory (TTL: 5 minutes)
- **Channel Participants**: Cache in-memory (invalidate on join/leave)
- **Task Status**: Cache with pub/sub invalidation (Redis if using Redis channel)

---

## Data Volume Estimates

**Assumptions** (per channel):
- 20-50 concurrent agents
- 10 messages/minute average (14,400 messages/day)
- 30-day retention policy
- Average message size: 1KB

**Storage Requirements**:
- Messages: 14,400 messages/day × 30 days × 1KB = ~432MB/month
- Agents: 50 agents × 2KB = 100KB (negligible)
- Tasks: 100 active tasks × 5KB = 500KB (negligible)

**Total: ~500MB per channel per month** (primarily message history)

With purge policies and retention, storage stabilizes at ~500MB.

---

## Security Considerations

### Data Protection

1. **Secrets**: Never store plaintext tokens/passwords
   - Use environment variables
   - Encrypt at rest in database (if Relay Server)

2. **Message Encryption**: Channel-specific
   - Discord: TLS in transit (Discord handles encryption)
   - SignalR: TLS in transit
   - Redis: TLS optional, configure redis-cli with `--tls`
   - Relay Server: TLS mandatory

3. **Access Control**:
   - Shared token per channel (scoped to channel)
   - Optional role-based access (filter by `allowedAgentRoles`)

### Compliance

- **Data Retention**: Configurable purge policies (GDPR compliance)
- **Audit Trail**: Message history with timestamps
- **PII**: Avoid storing personal data in messages (agent IDs are UUIDs, not names)

---

## Phase 1 Design Complete

Data model fully specified with:
- ✅ 6 core entities
- ✅ Validation rules
- ✅ State transitions
- ✅ Relationships (ERD)
- ✅ Performance indexes
- ✅ Security considerations

**Next**: Generate API contracts (message-protocol.json, capability-schema.json, etc.)
