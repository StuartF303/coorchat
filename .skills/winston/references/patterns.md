# Winston / Logging Patterns Reference

## Contents
- Logger Injection Pattern
- Structured Metadata Convention
- Log Level Filtering
- LogFormatter Usage
- Child Logger Pattern
- Error Logging Pattern
- Anti-Patterns

## Logger Injection Pattern

Every class that needs logging accepts an optional `Logger` via its config object. This is the dominant pattern across 11+ files.

```typescript
// src/agents/AgentRegistry.ts
export interface AgentRegistryConfig {
  logger?: Logger;
  timeoutMs?: number;
  enableTimeoutChecking?: boolean;
}

export class AgentRegistry {
  private logger: Logger;

  constructor(config: AgentRegistryConfig = {}) {
    this.logger = config.logger || createLogger();
  }
}
```

```typescript
// src/tasks/TaskQueue.ts — same pattern
export class TaskQueue {
  private logger: Logger;

  constructor(config: TaskQueueConfig = {}) {
    this.logger = config.logger || createLogger();
  }
}
```

### WARNING: ChannelAdapter Skips Injection

**The Problem:**

```typescript
// BAD — src/channels/base/ChannelAdapter.ts:48
// Logger is created directly, not from config
constructor(config: ChannelConfig) {
  this.logger = createLogger(); // No config.logger option
}
```

**Why This Breaks:**
1. Cannot inject a mock logger for testing channel adapters
2. Cannot customize log level per channel
3. Inconsistent with every other class in the codebase

**The Fix:**

```typescript
// GOOD — accept logger via config like everything else
constructor(config: ChannelConfig & { logger?: Logger }) {
  this.logger = config.logger || createLogger();
}
```

## Structured Metadata Convention

Log calls use a `message` + `metadata` pattern. Metadata fields are typed via `LogMetadata`.

```typescript
// Standard fields used across the codebase
this.logger.info('Agent added to registry', {
  agentId: agent.id,       // Agent identifier
  role: agent.role,        // Agent role
  component: 'AgentRegistry', // Source module
});

this.logger.warn('Task already in queue', {
  taskId: task.id,         // Task identifier
  queueSize: this.queue.length, // Contextual data
});

this.logger.error('Redis publisher error', {
  error,                   // Error object (serialized by formatter)
  host: this.redisConfig.host,
});

this.logger.debug('Redis publisher connected'); // No metadata needed
```

### WARNING: Inconsistent Metadata Keys

**The Problem:**

```typescript
// BAD — different files use different keys for the same concept
this.logger.info('Connected', { host: 'localhost' });   // RedisChannel
this.logger.info('Connected', { server: 'localhost' });  // elsewhere
```

**Why This Breaks:** Log aggregation and search become unreliable. Standardize on the `LogMetadata` interface fields.

**The Fix:** Always use `LogMetadata` typed fields: `component`, `agentId`, `taskId`, `correlationId`, `error`, `duration`.

## Log Level Filtering

Levels use numeric comparison — higher value = higher severity.

```typescript
// src/logging/Logger.ts
export const LogLevelValue: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 40,
  [LogLevel.WARN]: 30,
  [LogLevel.INFO]: 20,
  [LogLevel.DEBUG]: 10,
};

// BaseLogger.isLevelEnabled — only logs at or above current level
isLevelEnabled(level: LogLevel): boolean {
  return LogLevelValue[level] >= LogLevelValue[this._level];
}
```

### WARNING: LOG_LEVEL Environment Variable Is Ignored

**The Problem:**

```typescript
// BAD — createLogger ignores process.env.LOG_LEVEL
export function createLogger(
  level: LogLevel = LogLevel.INFO, // Always defaults to INFO
  type: 'console' | 'noop' = 'console'
): Logger {
  return new ConsoleLogger(level);
}
```

**Why This Breaks:** The `.env.example` documents `LOG_LEVEL=info` and CLAUDE.md lists it as a config option, but setting it does nothing. Every deployed instance runs at INFO regardless.

**The Fix:**

```typescript
// GOOD — respect environment variable
export function createLogger(
  level?: LogLevel,
  type: 'console' | 'noop' = 'console'
): Logger {
  const resolvedLevel = level
    || (process.env.LOG_LEVEL?.toUpperCase() as LogLevel)
    || LogLevel.INFO;
  return type === 'noop'
    ? new NoopLogger(resolvedLevel)
    : new ConsoleLogger(resolvedLevel);
}
```

## LogFormatter Usage

`LogFormatter` exists at `src/logging/LogFormatter.ts` but is **not wired** into `ConsoleLogger`. Three pre-built formatters are exported:

```typescript
// src/logging/LogFormatter.ts — exported singletons
export const jsonFormatter = createFormatter({ format: 'json' });
export const prettyJsonFormatter = createFormatter({ format: 'json', prettyPrint: true });
export const textFormatter = createFormatter({ format: 'text', colorize: true });
```

To use them, override `ConsoleLogger.format()`:

```typescript
import { textFormatter } from './LogFormatter.js';

class FormattedConsoleLogger extends ConsoleLogger {
  protected format(entry: LogEntry): string {
    return textFormatter.format(entry); // Colorized text output
  }
}
```

Features in `LogFormatter`:
- Circular reference detection via `WeakSet`
- Error serialization (message, name, stack)
- Depth-limited metadata (default: 5 levels)
- ANSI color codes per log level
- Text format: `HH:MM:SS.mmm [LEVEL] message {key=value}`

## Child Logger Pattern

`BaseLogger.child()` creates a new logger with preset metadata merged into every call.

```typescript
// Create a child logger scoped to a component
const channelLogger = this.logger.child({ component: 'RedisChannel' });
channelLogger.info('Connected'); // Automatically includes component metadata

// Child of child — metadata merges
const subLogger = channelLogger.child({ agentId: 'agent-1' });
subLogger.info('Ready'); // Has both component and agentId
```

**Note:** No class in the codebase currently uses `child()`. It exists but is untested.

## Error Logging Pattern

The codebase follows a consistent error serialization pattern:

```typescript
// GOOD — matches project convention
try {
  await this.publisher.publish(channel, payload);
} catch (err) {
  this.logger.error('Failed to publish', {
    error: err instanceof Error ? err : new Error(String(err)),
    channel: this.channelName,
  });
}
```

`LogFormatter.sanitizeMetadata()` converts `Error` objects to `{ message, name, stack }` for JSON serialization.

### WARNING: Passing Raw Error Objects

**The Problem:**

```typescript
// BAD — some files pass non-Error values
this.logger.error('Failed', { error }); // 'error' might be a string
```

**Why This Breaks:** If `error` is a string, `LogFormatter` won't extract stack traces. If it's an unknown type, JSON.stringify may lose information.

**The Fix:** Always normalize: `error instanceof Error ? error : new Error(String(error))`.
