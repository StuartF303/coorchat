---
name: winston
description: |
  Structures JSON logging with levels and transports for Node.js applications.
  Use when: configuring structured logging, adding log transports (console, file, HTTP), formatting log output, setting log levels, creating child loggers, or integrating Winston into the custom Logger interface.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Winston Skill

## WARNING: Winston Is Declared But NOT Used

CoorChat lists `winston@^3.11.0` in `package.json` but **never imports it**. The codebase uses a custom logging system at `src/logging/Logger.ts` and `src/logging/LogFormatter.ts`. This custom system implements a `Logger` interface with `ConsoleLogger` and `NoopLogger` classes, level filtering, child loggers, and structured metadata.

If Winston integration is needed, it must replace or wrap the existing `ConsoleLogger` — not be bolted on alongside it.

## Current Logging Architecture

### Custom Logger Interface

```typescript
// src/logging/Logger.ts — the ACTUAL logging API
import { createLogger, type Logger, LogLevel } from '../logging/Logger.js';

// Singleton default logger
export const logger = createLogger(); // ConsoleLogger at INFO level

// Dependency injection pattern (used by 11+ classes)
constructor(config: AgentRegistryConfig = {}) {
  this.logger = config.logger || createLogger();
}
```

### Structured Metadata

```typescript
// Every log call accepts optional LogMetadata
this.logger.info('Agent added to registry', {
  agentId: agent.id,
  role: agent.role,
  component: 'AgentRegistry',
});

this.logger.error('Redis publisher error', { error });
this.logger.warn('Redis TLS not enabled', { host: this.redisConfig.host });
this.logger.debug('Redis subscriber connected');
```

### Log Levels

| Level | Value | Console Method | Use |
|-------|-------|----------------|-----|
| ERROR | 40 | `console.error` | Failures requiring attention |
| WARN | 30 | `console.warn` | Degraded state, insecure config |
| INFO | 20 | `console.info` | Normal operations, state changes |
| DEBUG | 10 | `console.debug` | Detailed diagnostic data |

## Key Gaps (Why You Might Want Winston)

1. **No file transport** — all logs go to stdout/stderr only
2. **`LOG_LEVEL` env var is ignored** — hardcoded to INFO
3. **LogFormatter is disconnected** — exists but not wired into ConsoleLogger
4. **No log rotation** — no production logging strategy
5. **No external transport** — no Syslog, HTTP, or cloud logging

## Integrating Winston (If Needed)

```typescript
// Replace ConsoleLogger with Winston-backed implementation
import winston from 'winston';
import { BaseLogger, LogEntry, LogLevel } from './Logger.js';

export class WinstonLogger extends BaseLogger {
  private winstonLogger: winston.Logger;

  constructor(level: LogLevel = LogLevel.INFO) {
    super(level);
    this.winstonLogger = winston.createLogger({
      level: level.toLowerCase(),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ],
    });
  }

  protected write(entry: LogEntry): void {
    this.winstonLogger.log(entry.level.toLowerCase(), entry.message, entry.metadata);
  }
}
```

## See Also

- [patterns](references/patterns.md) — Logging patterns across the codebase
- [workflows](references/workflows.md) — Setup, testing, and migration workflows

## Related Skills

- See the **node** skill for ES module imports and process lifecycle
- See the **typescript** skill for strict mode and type patterns
- See the **vitest** skill for mocking loggers in tests

## Documentation Resources

> Fetch latest Winston documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "winston"
2. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/winstonjs/winston`

**Recommended Queries:**
- "winston createLogger transports formats"
- "winston custom transport implementation"
- "winston child logger metadata"
