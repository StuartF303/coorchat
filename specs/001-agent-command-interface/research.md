# Research Document: Agent Command Interface

**Feature**: Agent Command Interface
**Date**: 2026-02-15
**Phase**: Phase 0 - Research & Decisions

This document captures all technical decisions made during the research phase, including alternatives considered and rationale for choices.

---

## Decision 1: Command Parsing Strategy

### Research Question
How should we parse natural text commands like "list agents", "config T14 model opus", "@T14 hello" in TypeScript?

### Options Evaluated

1. **Regex-based parsing**: Pattern matching for each command type
2. **String split + manual parsing**: Split on spaces, analyze tokens
3. **Commander.js integration**: Use existing CLI library

### Analysis

**Regex Approach**:
- ✅ Built-in case-insensitivity (`/pattern/i`)
- ✅ Explicit pattern definitions
- ❌ Becomes unmaintainable at 35+ patterns
- ❌ Order-dependent matching creates subtle bugs
- ❌ No automatic help text generation

**Token Split Approach**:
- ✅ Clear command → handler mapping via Map
- ✅ Easy to add metadata (descriptions, aliases, examples)
- ✅ Can generate help text from command definitions
- ✅ Scales well to 35+ commands
- ✅ Simple fuzzy matching with conditionals
- ❌ Manual token parsing in each handler

**Commander.js Approach**:
- ✅ Declarative command definitions
- ✅ Automatic help generation
- ❌ Designed for CLI, not natural text
- ❌ Requires text → argv conversion
- ❌ Not case-insensitive by default
- ❌ Poor fit for @mentions pattern

### Decision: **Token Split + Manual Parsing**

**Rationale**:
- Zero dependencies (native JavaScript)
- Natural fit for conversational text input
- Maintainable at scale (35+ commands)
- Flexible for fuzzy matching and aliases
- Can enhance with Levenshtein distance for typo suggestions

**Implementation Pattern**:
```typescript
interface CommandDef {
  minArgs: number;
  description: string;
  aliases?: string[];
  execute: (tokens: string[], userId: string) => Promise<void>;
  examples?: string[];
}

const commands = new Map<string, CommandDef>();

// Register command
commands.set('config', {
  minArgs: 3,
  description: 'Configure agent settings',
  aliases: ['set'],
  examples: ['config T14 model opus'],
  execute: async (tokens, userId) => {
    const agentId = tokens[1];
    const setting = tokens[2].toLowerCase();
    const value = tokens.slice(3).join(' ');
    // ... handler logic
  },
});

// Parse command
const tokens = text.trim().split(/\s+/);
const commandName = tokens[0].toLowerCase();
const command = commands.get(commandName);
await command.execute(tokens, userId);
```

**Alternatives Considered**: Commander.js rejected due to impedance mismatch with natural language; regex rejected due to maintainability concerns at scale.

---

## Decision 2: Slack Response Formatting

### Research Question
How should we format rich responses (agent lists, status tables, errors) in Slack messages?

### Options Evaluated

1. **Block Kit Table Block**: Native table rendering (new in Aug 2025)
2. **Markdown (mrkdwn)**: Simple markdown formatting
3. **Block Kit Sections**: Structured layouts with headers/fields
4. **Hybrid**: Different formats for different use cases

### Analysis

**Block Kit Table Block**:
- ✅ Native table rendering with alignment
- ✅ Excellent mobile experience (horizontal scroll)
- ✅ Supports rich text (bold, emoji, mentions)
- ✅ Best for 4+ column data
- ❌ Max 100 rows, 20 columns
- ❌ Only one table per message

**Markdown (mrkdwn)**:
- ✅ Simplest implementation
- ✅ Fast and lightweight
- ✅ Works for lists and simple formatting
- ❌ Poor table alignment on mobile
- ❌ No semantic structure

**Block Kit Sections**:
- ✅ Rich visual layouts
- ✅ Two-column field layout for key-value pairs
- ✅ Auto-stacking on mobile
- ✅ Better hierarchy than markdown
- ❌ 3,000 char limit per text block
- ❌ 50 block limit per message

### Decision: **Hybrid Strategy**

**Rationale**:
- Use **Block Kit Table** for agent status tables (10+ agents)
- Use **Block Kit Sections** for structured data (errors, single agent status)
- Use **mrkdwn** for simple messages (help text, confirmations)
- Provides best readability for each use case

**Implementation Pattern**:
```typescript
// Agent list (Table Block)
async sendAgentTable(agents: Agent[]): Promise<void> {
  const rows = [
    [{ type: 'raw_text', text: 'Agent ID' }, ...], // header
    ...agents.map(a => [
      { type: 'raw_text', text: a.id },
      { type: 'raw_text', text: a.role },
      // ... more columns
    ])
  ];
  await slackClient.chat.postMessage({
    channel,
    attachments: [{ blocks: [{ type: 'table', rows }] }]
  });
}

// Error message (Section Block)
async sendError(error: Error): Promise<void> {
  await slackClient.chat.postMessage({
    channel,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `:x: *Error*` } },
      { type: 'section', text: { type: 'mrkdwn', text: error.message } }
    ]
  });
}

// Simple confirmation (mrkdwn)
async sendConfirmation(msg: string): Promise<void> {
  await slackClient.chat.postMessage({
    channel,
    text: `:white_check_mark: ${msg}`,
    mrkdwn: true
  });
}
```

**Character Limit Handling**:
- Table Block: Paginate at 90 rows (~12,000 chars)
- Text blocks: Split at 3,000 chars
- Total message: Monitor JSON size, stay under 16 KB

**Alternatives Considered**: mrkdwn-only rejected due to poor table rendering on mobile; Block Kit-only rejected due to complexity for simple messages.

---

## Decision 3: Configuration File Format

### Research Question
How should agent configuration (model, role, queueLimit) persist to local storage?

### Options Evaluated

1. **JSON** (.coorchat/config.json)
2. **YAML** (.coorchat/config.yaml)
3. **TOML** (.coorchat/config.toml)

### Analysis

**JSON**:
- ✅ Zero dependencies (native Node.js)
- ✅ Fast parsing (native C++)
- ✅ Universal compatibility
- ✅ Project already uses JSON (package.json, tsconfig.json)
- ❌ No comments support
- ❌ Verbose for complex structures

**YAML**:
- ✅ Highly readable
- ✅ Supports comments
- ✅ Already in dependencies (`yaml` package)
- ❌ Indentation-sensitive (whitespace errors)
- ❌ Slower parsing than JSON

**TOML**:
- ✅ Readable and supports comments
- ✅ Explicit type safety
- ❌ Requires additional dependency
- ❌ Less common in Node.js ecosystem

### Decision: **JSON with XDG-compliant paths**

**Rationale**:
- Zero dependencies, universal compatibility
- Fast parsing with native implementation
- Ecosystem alignment (project uses JSON heavily)
- Machine-readable focus (programmatic config, not hand-edited often)
- Proven atomic write pattern

**Storage Location**:
```
Priority order:
1. $XDG_CONFIG_HOME/coorchat/config.json (if XDG_CONFIG_HOME set)
2. ~/.config/coorchat/config.json (Linux/Unix default)
3. ~/Library/Application Support/coorchat/config.json (macOS)
4. %APPDATA%/coorchat/config.json (Windows)
5. ~/.coorchat/config.json (fallback)
```

**Atomic Write Implementation**:
```typescript
async write(config: AgentConfig): Promise<void> {
  const tempPath = `${this.configPath}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    // Write to temp file
    await writeFile(tempPath, JSON.stringify(config, null, 2), {
      encoding: 'utf-8',
      mode: 0o600  // User read/write only
    });
    // Atomic rename (prevents corruption on crash)
    await rename(tempPath, this.configPath);
  } catch (error) {
    await unlink(tempPath);  // Cleanup on failure
    throw error;
  }
}
```

**Atomicity Guarantees**:
- `fs.rename()` is atomic on POSIX (Linux/macOS)
- Write-to-temp + rename prevents partial writes
- No corruption possible even during process crash
- Multiple readers always safe
- Multiple writers: last-write-wins (no corruption)

**Alternatives Considered**: YAML rejected due to indentation fragility and slower parsing; TOML rejected due to extra dependency and ecosystem mismatch.

---

## Decision 4: Queue Limit Enforcement

### Research Question
Where should queue depth limits be enforced and how should rejections be handled?

### Options Evaluated

1. **Agent-side enforcement**: Agent rejects tasks when queue full
2. **Relay server enforcement**: Server tracks queue depth, rejects before routing
3. **Hybrid**: Both track, agent has final say

### Decision: **Agent-side enforcement**

**Rationale**:
- Agent has authoritative view of its own queue
- No sync issues between agent and relay server
- Agent can adjust limit dynamically based on resources
- Simpler architecture (no relay server state)

**Implementation**:
```typescript
class TaskQueue {
  private queue: Task[] = [];
  private limit: number;

  async add(task: Task): Promise<void> {
    if (this.queue.length >= this.limit) {
      throw new Error(
        `Queue full (${this.queue.length}/${this.limit}). ` +
        `Try increasing limit with: config ${agentId} queue-limit <number>`
      );
    }
    this.queue.push(task);
  }
}
```

**Error Visibility**: Command handler catches rejection, formats user-friendly error with instructions to increase limit.

**Alternatives Considered**: Relay server enforcement rejected due to sync complexity; hybrid rejected as over-engineered.

---

## Decision 5: Agent-to-Agent Communication Pattern

### Research Question
How should direct messages (@agent-id) be routed to target agents?

### Options Evaluated

1. **Through relay server**: Command handler → relay → target agent → relay → user
2. **Direct channel**: Command handler broadcasts question, agent responds directly
3. **Hybrid**: Use existing MessageType protocol for routing

### Decision: **Hybrid - Leverage existing MessageType protocol**

**Rationale**:
- Reuse existing `AGENT_QUERY` or create `DIRECT_MESSAGE` message type
- Relay server already handles agent routing
- Consistent with task assignment pattern
- Centralized logging and audit trail

**Implementation**:
```typescript
// In CommunicationCommands handler
async handleDirectMessage(agentId: string, message: string, userId: string) {
  // Send via protocol
  await channel.sendMessage({
    messageType: MessageType.DIRECT_MESSAGE,
    targetAgentId: agentId,
    senderId: userId,
    payload: { text: message },
    timestamp: new Date().toISOString(),
  });

  // Wait for response with 30-second timeout
  const response = await this.waitForResponse(agentId, 30000);

  if (!response) {
    await channel.sendText(
      `Agent ${agentId} did not respond (may be disconnected)`
    );
  } else {
    await channel.sendText(response.text);
  }
}
```

**Timeout Handling**: 30-second timeout with clear user notification if agent doesn't respond.

**Alternatives Considered**: Direct channel broadcast rejected due to lack of delivery guarantees; pure relay rejected as too centralized (doesn't leverage existing protocol).

---

## Decision 6: Agent Metrics Collection

### Research Question
Where should task completion metrics be tracked and stored?

### Options Evaluated

1. **Agent-side in-memory**: Each agent tracks own metrics
2. **Relay server centralized**: Server aggregates all metrics
3. **Local file per agent**: Persist metrics to agent's config directory

### Decision: **Agent-side in-memory with local file persistence**

**Rationale**:
- Agent has authoritative view of task lifecycle
- No network overhead for metric updates
- Privacy-preserving (no central aggregation)
- Persist to local file for restart resilience

**Implementation**:
```typescript
interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageCompletionTime: number;
  lastTaskTimestamp: string;
}

class TaskMetrics {
  private metricsPath: string;
  private metrics: TaskMetrics;

  async recordCompletion(task: Task, duration: number): Promise<void> {
    this.metrics.completedTasks++;
    this.metrics.totalTasks++;
    this.updateAverage(duration);
    await this.persist();
  }

  private async persist(): Promise<void> {
    await writeFile(this.metricsPath, JSON.stringify(this.metrics, null, 2));
  }
}
```

**Retention Policy**: Keep in-memory for current session, persist to file for historical tracking. No automatic expiration (user can delete file to reset).

**Performance Impact**: Minimal - async file writes, no network calls, simple counters.

**Alternatives Considered**: Relay server centralized rejected due to privacy concerns and network overhead; pure in-memory rejected due to loss on restart.

---

## Summary of Key Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Command Parsing | Token split + manual parsing | Simple, maintainable, no dependencies |
| Response Formatting | Hybrid (Table/Sections/mrkdwn) | Best format for each use case |
| Config Format | JSON with XDG paths | Zero deps, atomic writes, ecosystem fit |
| Config Location | ~/.config/coorchat/ (XDG) | Modern standard, cross-platform |
| Queue Enforcement | Agent-side | Authoritative view, simpler |
| Agent Messaging | Existing MessageType protocol | Reuse infrastructure, consistency |
| Metrics Storage | Agent in-memory + local file | Privacy, performance, resilience |

---

## Implementation Notes

### Code Examples Location
- Full command parser: See research agent output (a77517f)
- Slack formatter patterns: See research agent output (a4d3339)
- Config store implementation: See research agent output (a816fca)

### Dependencies Required
- **No new dependencies** for core functionality
- Existing packages sufficient: @slack/socket-mode, @slack/web-api, winston, zod

### Performance Considerations
- Command parsing: <10ms for 35+ commands (Map lookup is O(1))
- Config I/O: Async file operations, no blocking
- Slack API: Rate limits handled by @slack/web-api
- Metrics: In-memory updates, async persistence

### Security Considerations
- Config files: 0o600 permissions (user read/write only)
- Input sanitization: Prevent command injection
- Atomic writes: Prevent config corruption
- Error messages: Don't leak sensitive paths or data

---

## Next Steps

Proceed to Phase 1: Design & Contracts
- Create data-model.md (entity definitions)
- Create contracts/commands.schema.json (command specifications)
- Create quickstart.md (developer guide)
- Update agent context (CLAUDE.md)
