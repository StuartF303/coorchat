# Node.js Patterns Reference

## Contents
- Async Main Entry Point
- Graceful Shutdown
- Set-Based Handler Management
- Timer Lifecycle
- Singleton Exports
- Builder Pattern (Fluent API)
- Environment Variable Resolution
- Crypto Patterns
- Keep-Alive Process
- Anti-Patterns

## Async Main Entry Point

Every CoorChat entry point follows this structure. The `main().catch()` at the bottom is the top-level error boundary.

```typescript
#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  // 1. Validate env
  // 2. Create config
  // 3. Connect channel
  // 4. Register handlers
  // 5. Start timers
  // 6. Register signal handlers
  // 7. Keep alive
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
```

**Why this pattern:** Top-level await works in ESM, but wrapping in `main()` gives you a single catch for the entire startup sequence. If any step throws, the process exits cleanly with code 1.

## Graceful Shutdown

```typescript
const shutdown = async () => {
  console.log('Shutting down...');
  clearInterval(heartbeatInterval);  // 1. Stop timers first
  agentRegistry.destroy();            // 2. Cleanup registries
  await channel.disconnect();         // 3. Await async cleanup
  process.exit(0);                    // 4. Exit clean
};

process.on('SIGINT', shutdown);   // Ctrl+C
process.on('SIGTERM', shutdown);  // Container kill / PM2
```

**Order matters:** Stop timers before disconnecting channels. A timer firing during disconnect causes race conditions.

### WARNING: Leaked Timer Handles

**The Problem:**

```typescript
// BAD — timer keeps process alive after "shutdown"
setInterval(doWork, 15000);
// ... later in shutdown:
await channel.disconnect();
process.exit(0); // Timer still referenced, but process.exit forces quit
```

**Why This Breaks:**
1. Without `process.exit()`, the timer prevents Node from exiting naturally
2. If you remove `process.exit()` for cleaner shutdown, the process hangs forever
3. In tests, leaked timers cause `--forceExit` warnings in Vitest

**The Fix:**

```typescript
// GOOD — always capture and clear timer handles
const timer = setInterval(doWork, 15000);
// In shutdown:
clearInterval(timer);
await channel.disconnect();
// Process exits naturally — no dangling references
```

## Set-Based Handler Management

CoorChat uses `Set<Handler>` instead of `EventEmitter`. Each `onX()` method returns an unregister function.

```typescript
// Register
const unregister = channel.onMessage((msg) => {
  console.log('Received:', msg.messageType);
});

// Later, stop listening
unregister();
```

**Why not EventEmitter:** Sets prevent duplicate handler registration, and the returned unregister function is cleaner than `removeListener` which requires keeping a reference to the exact function.

### Safe Handler Invocation

```typescript
protected safeCall<T extends unknown[]>(
  handler: (...args: T) => void | Promise<void>,
  ...args: T
): void {
  try {
    const result = handler(...args);
    if (result instanceof Promise) {
      result.catch((error) => {
        console.error('Handler error:', error);
      });
    }
  } catch (error) {
    console.error('Handler error:', error);
  }
}
```

**Critical:** A throwing handler must never crash the dispatch loop. `safeCall` catches both sync throws and async rejections.

## Timer Lifecycle

```typescript
// Reconnection with exponential backoff
protected reconnectTimer?: NodeJS.Timeout;

protected scheduleReconnect(): void {
  this.clearReconnectTimer();
  this.reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

  this.reconnectTimer = setTimeout(async () => {
    try { await this.connect(); }
    catch { /* connect() handles retry */ }
  }, delay);
}

protected clearReconnectTimer(): void {
  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;  // GC-friendly
  }
}
```

**Pattern:** Always clear before setting (prevents double timers). Always set to `undefined` after clearing (prevents stale references).

## Singleton Exports

```typescript
// GOOD — module-level singletons
export const logger = createLogger();
export const validator = new ConfigValidator();
export const resolver = new EnvironmentResolver();
```

ES modules guarantee single evaluation. These singletons are created once and shared across all importers. No need for a getInstance() pattern.

## Builder Pattern (Fluent API)

```typescript
const msg = new MessageBuilder()
  .type(MessageType.DIRECT_MESSAGE)
  .from('agent-1')
  .to('agent-2')
  .priority(8)
  .payload({ text: 'Hello' })
  .build();
```

Each method returns `this` for chaining. `build()` validates required fields and returns the immutable message. See the **typescript** skill for type safety in builders.

## Environment Variable Resolution

```typescript
// Simple: direct access with fallback
const host = process.env.REDIS_HOST || 'localhost';
const port = parseInt(process.env.REDIS_PORT || '6379', 10);

// Advanced: EnvironmentResolver supports substitution
const resolver = new EnvironmentResolver();
resolver.resolve('${REDIS_HOST:-localhost}');      // Default value
resolver.resolve('${SHARED_TOKEN:?Token required}'); // Throw if missing
```

See the **zod** skill for validation after resolution.

## Crypto Patterns

```typescript
import { randomBytes, createHash } from 'crypto';

// Token generation — always use crypto.randomBytes, never Math.random
const token = 'cct_' + randomBytes(32).toString('hex');

// Hashing for storage — never store plaintext tokens
const hash = createHash('sha256').update(token).digest('hex');

// Timing-safe comparison — prevents timing attacks
let result = 0;
for (let i = 0; i < a.length; i++) {
  result |= a[i] ^ b[i];
}
const isEqual = result === 0;
```

## Keep-Alive Process

```typescript
// After all setup, keep the process running
await new Promise(() => {}); // Never resolves
```

The process stays alive until a signal handler calls `process.exit()`. This is simpler than a busy loop or `setInterval` keepalive.

### WARNING: Using Math.random for Security

**The Problem:**

```typescript
// BAD — predictable, not cryptographically secure
const token = Math.random().toString(36).substring(2);
```

**Why This Breaks:** `Math.random()` uses a PRNG that can be predicted. Tokens generated this way are vulnerable to brute force.

**The Fix:**

```typescript
// GOOD — cryptographically secure
import { randomBytes } from 'crypto';
const token = randomBytes(32).toString('hex');
```
