# Winston / Logging Workflows Reference

## Contents
- Adding Logging to a New Class
- Testing with Mock Loggers
- Enabling Debug Logging
- Migrating to Winston
- Adding File Transport
- Production Logging Checklist

## Adding Logging to a New Class

Follow the dependency injection pattern used by every other class in the codebase.

```typescript
import type { Logger } from '../logging/Logger.js';
import { createLogger } from '../logging/Logger.js';

export interface MyServiceConfig {
  logger?: Logger;
  // ... other config
}

export class MyService {
  private logger: Logger;

  constructor(config: MyServiceConfig = {}) {
    this.logger = config.logger || createLogger();
  }

  async doWork(): Promise<void> {
    this.logger.info('Work started', { component: 'MyService' });
    try {
      // ... work
      this.logger.debug('Processing complete', { duration: 42 });
    } catch (err) {
      this.logger.error('Work failed', {
        error: err instanceof Error ? err : new Error(String(err)),
        component: 'MyService',
      });
      throw err;
    }
  }
}
```

Copy this checklist and track progress:
- [ ] Step 1: Add `logger?: Logger` to config interface
- [ ] Step 2: Initialize `this.logger = config.logger || createLogger()` in constructor
- [ ] Step 3: Add `info` logs for state transitions (connected, disconnected, task complete)
- [ ] Step 4: Add `error` logs in catch blocks with normalized Error objects
- [ ] Step 5: Add `warn` for degraded states (insecure config, fallback behavior)
- [ ] Step 6: Add `debug` for diagnostic details (connection params, payload sizes)

## Testing with Mock Loggers

Use `NoopLogger` to suppress output in tests, or `vi.fn()` to assert log calls. See the **vitest** skill for mocking patterns.

### Option 1: NoopLogger (Suppress Output)

```typescript
import { createLogger } from '../../src/logging/Logger.js';

const registry = new AgentRegistry({
  logger: createLogger(LogLevel.INFO, 'noop'),
  enableTimeoutChecking: false,
});
```

### Option 2: Spy on Logger Calls

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createLogger, LogLevel } from '../../src/logging/Logger.js';

describe('MyService', () => {
  it('should log errors on failure', async () => {
    const mockLogger = createLogger(LogLevel.DEBUG, 'noop');
    const errorSpy = vi.spyOn(mockLogger, 'error');

    const service = new MyService({ logger: mockLogger });
    await expect(service.doWork()).rejects.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      'Work failed',
      expect.objectContaining({ component: 'MyService' })
    );
  });
});
```

### Option 3: Full Mock Logger

```typescript
const mockLogger = {
  level: LogLevel.DEBUG,
  setLevel: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
  isLevelEnabled: vi.fn().mockReturnValue(true),
  child: vi.fn().mockReturnThis(),
} satisfies Logger;
```

## Enabling Debug Logging

### WARNING: LOG_LEVEL Env Var Does Nothing (Currently)

The `createLogger()` factory ignores `process.env.LOG_LEVEL`. Until this is fixed, you must pass the level explicitly.

```typescript
// Workaround: pass level directly
import { createLogger, LogLevel } from '../logging/Logger.js';

const logger = createLogger(LogLevel.DEBUG);
```

### After Fixing createLogger

Once `createLogger()` reads `process.env.LOG_LEVEL`:

```bash
# Set in .env
LOG_LEVEL=debug

# Or inline
LOG_LEVEL=debug npm run dev
```

Iterate-until-pass pattern:
1. Set `LOG_LEVEL=debug`
2. Run the failing operation
3. Read debug output to identify the issue
4. Fix the issue
5. Set `LOG_LEVEL=info` to reduce noise
6. Verify the fix still works at INFO level

## Migrating to Winston

Winston is already in `package.json` (`^3.11.0`) but unused. To integrate:

### Step 1: Create WinstonLogger Class

```typescript
// src/logging/WinstonLogger.ts
import winston from 'winston';
import { BaseLogger, LogEntry, LogLevel } from './Logger.js';

const LEVEL_MAP: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'error',
  [LogLevel.WARN]: 'warn',
  [LogLevel.INFO]: 'info',
  [LogLevel.DEBUG]: 'debug',
};

export class WinstonLogger extends BaseLogger {
  private winstonLogger: winston.Logger;

  constructor(level: LogLevel = LogLevel.INFO) {
    super(level);
    this.winstonLogger = winston.createLogger({
      level: LEVEL_MAP[level],
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'coorchat' },
      transports: [new winston.transports.Console()],
    });
  }

  protected write(entry: LogEntry): void {
    const { level, message, metadata, timestamp } = entry;
    this.winstonLogger.log({
      level: LEVEL_MAP[level],
      message,
      timestamp,
      ...metadata,
    });
  }

  setLevel(level: LogLevel): void {
    super.setLevel(level);
    this.winstonLogger.level = LEVEL_MAP[level];
  }
}
```

### Step 2: Update createLogger Factory

```typescript
// src/logging/Logger.ts — add 'winston' option
export function createLogger(
  level?: LogLevel,
  type: 'console' | 'noop' | 'winston' = 'console'
): Logger {
  const resolvedLevel = level
    || (process.env.LOG_LEVEL?.toUpperCase() as LogLevel)
    || LogLevel.INFO;

  switch (type) {
    case 'winston':
      return new WinstonLogger(resolvedLevel);
    case 'noop':
      return new NoopLogger(resolvedLevel);
    default:
      return new ConsoleLogger(resolvedLevel);
  }
}
```

### Step 3: Zero Changes to Consumers

Because all 14 files use the `Logger` interface, switching to Winston requires **no changes** to any consumer. The interface is already correct.

Copy this checklist and track progress:
- [ ] Step 1: Create `src/logging/WinstonLogger.ts`
- [ ] Step 2: Update `createLogger()` to accept `'winston'` type
- [ ] Step 3: Read `LOG_LEVEL` from environment
- [ ] Step 4: Test with `NoopLogger` in test suite (no behavior change)
- [ ] Step 5: Verify JSON output format matches existing `ConsoleLogger`
- [ ] Step 6: Add file transport for production (see below)

## Adding File Transport

After Winston integration, add file-based logging for production:

```typescript
// Production transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    })
  );
}
```

## Production Logging Checklist

Copy this checklist and track progress:
- [ ] Fix `LOG_LEVEL` environment variable support
- [ ] Wire `LogFormatter` into `ConsoleLogger.format()`
- [ ] Add structured `component` metadata to all log calls
- [ ] Add `correlationId` propagation for request tracing
- [ ] Add file transport with rotation (Winston or custom)
- [ ] Add error-only transport for alerting
- [ ] Suppress debug/info in production (`LOG_LEVEL=warn`)
- [ ] Test that `NoopLogger` is used in test suite (no console spam)
- [ ] Remove unused winston dependency OR integrate it fully
