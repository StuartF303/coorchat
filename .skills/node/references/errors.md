# Node.js Error Handling Reference

## Contents
- Error Normalization Pattern
- Process Exit Strategy
- Async Error Boundaries
- Handler Error Safety
- Connection Error Recovery
- Common Runtime Errors
- Validation Errors
- Anti-Patterns

## Error Normalization Pattern

CoorChat normalizes all errors to `Error` instances. This is the standard pattern used throughout the codebase:

```typescript
// ALWAYS normalize — catches string throws, objects, undefined
const message = error instanceof Error
  ? error.message
  : String(error);
```

When re-throwing or wrapping:

```typescript
this.handleError(
  error instanceof Error
    ? error
    : new Error(`Connection failed: ${String(error)}`)
);
```

**Why:** Third-party libraries may throw strings, objects, or `undefined`. Without normalization, `error.message` throws `TypeError: Cannot read property 'message' of undefined`.

## Process Exit Strategy

```typescript
// Startup validation failure — exit immediately
const missing = required.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('Missing env vars:', missing.join(', '));
  process.exit(1);  // No point continuing without config
}

// Fatal unrecoverable error
main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});

// Graceful shutdown — cleanup then exit
const shutdown = async () => {
  clearInterval(heartbeat);
  await channel.disconnect();
  process.exit(0);  // Clean exit
};
```

**Exit code convention:**
- `0` — Clean shutdown (SIGINT/SIGTERM)
- `1` — Error (missing config, connection failure, unhandled exception)

## Async Error Boundaries

### Top-Level Boundary

```typescript
async function main() {
  // Everything here is caught by the .catch() below
  await riskyOperation();
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
```

### Connection Boundary

```typescript
async connect(): Promise<void> {
  this.setStatus(ConnectionStatus.CONNECTING);

  try {
    await this.doConnect();            // Subclass-specific
    this.setStatus(ConnectionStatus.CONNECTED);
    this.startHeartbeat();
  } catch (error) {
    this.setStatus(ConnectionStatus.FAILED);
    this.handleError(
      error instanceof Error
        ? error
        : new Error(`Connection failed: ${String(error)}`)
    );

    if (this.config.retry?.enabled) {
      await this.scheduleReconnect();  // Don't re-throw — retry
    } else {
      throw error;                      // Re-throw — caller handles
    }
  }
}
```

### Disconnect Boundary (finally)

```typescript
async disconnect(): Promise<void> {
  this.stopHeartbeat();
  this.clearReconnectTimer();

  try {
    await this.doDisconnect();
  } finally {
    // ALWAYS runs — even if doDisconnect() throws
    this.setStatus(ConnectionStatus.DISCONNECTED);
    this.connectionStartTime = undefined;
  }
}
```

**Why `finally`:** Disconnect must update status even if the underlying transport throws. A failed disconnect that leaves status as `CONNECTED` causes bugs on reconnect.

## Handler Error Safety

The `safeCall` pattern prevents one bad handler from killing the entire dispatch:

```typescript
protected safeCall<T extends unknown[]>(
  handler: (...args: T) => void | Promise<void>,
  ...args: T
): void {
  try {
    const result = handler(...args);
    // Catch async rejections too
    if (result instanceof Promise) {
      result.catch((error) => {
        console.error('Async handler error:', error);
      });
    }
  } catch (error) {
    console.error('Sync handler error:', error);
  }
}

// Usage — iterates ALL handlers even if one throws
this.messageHandlers.forEach((handler) => {
  this.safeCall(handler, message);
});
```

### WARNING: Unhandled Promise Rejections in Handlers

**The Problem:**

```typescript
// BAD — async handler rejection crashes the process
this.messageHandlers.forEach((handler) => {
  handler(message); // If handler is async and throws, unhandled rejection
});
```

**Why This Breaks:** Since Node.js 15, unhandled promise rejections terminate the process by default. A single async handler throwing kills all other handlers mid-dispatch.

**The Fix:**

```typescript
// GOOD — safeCall catches both sync and async errors
this.messageHandlers.forEach((handler) => {
  this.safeCall(handler, message);
});
```

## Connection Error Recovery

```typescript
// Exponential backoff with max delay
protected calculateBackoff(): number {
  const base = this.config.retry?.baseDelayMs || 1000;
  const max = 30000;
  return Math.min(base * Math.pow(2, this.reconnectAttempts), max);
}

// Retry loop
protected async scheduleReconnect(): Promise<void> {
  this.clearReconnectTimer();

  if (this.reconnectAttempts >= this.config.retry.maxAttempts) {
    this.setStatus(ConnectionStatus.FAILED);
    return; // Give up
  }

  this.reconnectAttempts++;
  const delay = this.calculateBackoff();
  this.setStatus(ConnectionStatus.RECONNECTING);

  this.reconnectTimer = setTimeout(async () => {
    try {
      await this.connect();
      this.reconnectAttempts = 0; // Reset on success
    } catch {
      // connect() will call scheduleReconnect() again
    }
  }, delay);
}
```

## Common Runtime Errors

### ERR_MODULE_NOT_FOUND

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/path/to/Foo'
imported from /path/to/Bar.js
```

**Cause:** Missing `.js` extension in import. See [modules.md](modules.md).

### ERR_REQUIRE_ESM

```
Error [ERR_REQUIRE_ESM]: require() of ES Module not supported
```

**Cause:** Using `require()` in an ESM package. Use `import` instead.

### ECONNREFUSED

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Cause:** Redis/SignalR server not running. Start the service before connecting. See the **redis** or **signalr** skill.

### TypeError: X is not a function

```
TypeError: channel.getStatus is not a function
```

**Cause:** Calling a method that doesn't exist. In CoorChat, `status` is a getter property, not `getStatus()`. Check the API in [types.md](types.md).

### SELF_SIGNED_CERT_IN_CHAIN

```
Error: self-signed certificate in certificate chain
```

**Cause:** HTTPS connection to development server with self-signed cert.

```typescript
// Development only — NEVER in production
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

## Validation Errors

```typescript
// Zod validation — structured error with path info
try {
  const config = ChannelConfigSchema.parse(rawConfig);
} catch (error) {
  if (error instanceof z.ZodError) {
    error.issues.forEach(issue => {
      console.error(`${issue.path.join('.')}: ${issue.message}`);
    });
  }
}
```

See the **zod** skill for schema patterns.

### WARNING: Swallowing Errors Silently

**The Problem:**

```typescript
// BAD — error disappears, debugging becomes impossible
try {
  await channel.connect();
} catch {
  // Do nothing
}
```

**Why This Breaks:** Connection failures silently ignored means the agent appears "connected" but never receives messages. Users spend hours debugging missing messages when the real issue is a swallowed auth error.

**The Fix:**

```typescript
// GOOD — log, then decide: retry or throw
try {
  await channel.connect();
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  logger.error('Connection failed:', msg);

  if (isRetryable(error)) {
    await scheduleReconnect();
  } else {
    throw error; // Propagate fatal errors
  }
}
```

### WARNING: Catching Errors Too Broadly

**The Problem:**

```typescript
// BAD — catches programming errors that should crash
try {
  const result = someFunction();
  await channel.sendMessage(result);
} catch {
  logger.error('Send failed, retrying...');
  await retry(); // Retrying a TypeError is pointless
}
```

**Why This Breaks:** `someFunction()` might throw a `TypeError` or `ReferenceError` due to a bug. Retrying a programming error wastes resources and hides the real problem.

**The Fix:**

```typescript
// GOOD — only catch expected operational errors
const result = someFunction(); // Let programming errors propagate

try {
  await channel.sendMessage(result);
} catch (error) {
  if (error instanceof ConnectionError) {
    await retry();
  } else {
    throw error;
  }
}
```

## Error Handling Checklist

Copy this checklist when implementing new async operations:

- [ ] Normalize errors: `error instanceof Error ? error.message : String(error)`
- [ ] Wrap async handlers with `safeCall` or try/catch
- [ ] Log before retrying — never retry silently
- [ ] Use `finally` for cleanup that must run regardless
- [ ] Set status to FAILED on unrecoverable errors
- [ ] Clear timers in error paths — not just happy paths
- [ ] Propagate fatal errors — don't swallow programming bugs
