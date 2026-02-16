# Node.js Types Reference

## Contents
- Node.js Built-in Types
- Timer Types
- Process Types
- Buffer and Crypto Types
- Handler Type Patterns
- Configuration Types
- Enum Runtime Values

## Node.js Built-in Types

CoorChat uses `NodeJS` namespace types for timer handles and process APIs.

```typescript
// Timer handles — use NodeJS.Timeout, not number
protected heartbeatTimer?: NodeJS.Timeout;
protected reconnectTimer?: NodeJS.Timeout;

// Start timer
this.heartbeatTimer = setInterval(() => { /* ... */ }, 15000);

// Clear timer
if (this.heartbeatTimer) {
  clearInterval(this.heartbeatTimer);
  this.heartbeatTimer = undefined;
}
```

### WARNING: Using `number` for Timer Types

**The Problem:**

```typescript
// BAD — browser type, not Node.js
let timer: number = setInterval(() => {}, 1000);
```

**Why This Breaks:** In Node.js, `setInterval` returns a `NodeJS.Timeout` object, not a number. Using `number` causes type errors in strict mode.

**The Fix:**

```typescript
// GOOD — correct Node.js type
let timer: NodeJS.Timeout | undefined;
timer = setInterval(() => {}, 1000);
```

## Process Types

```typescript
// Exit codes
process.exit(0);   // Success — clean shutdown
process.exit(1);   // Error — startup failure, fatal error

// Signal handlers
process.on('SIGINT', async () => { /* Ctrl+C */ });
process.on('SIGTERM', async () => { /* Kill signal */ });

// Environment — always string | undefined
const value: string | undefined = process.env.SHARED_TOKEN;

// Platform detection
const platform: NodeJS.Platform = process.platform; // 'win32' | 'linux' | 'darwin'
```

## Buffer and Crypto Types

```typescript
import { randomBytes, createHash } from 'crypto';

// randomBytes returns Buffer
const bytes: Buffer = randomBytes(32);
const hex: string = bytes.toString('hex');
const b64: string = bytes.toString('base64');
const b64url: string = bytes.toString('base64url');

// createHash returns Hash, .digest() returns string or Buffer
const hash: string = createHash('sha256')
  .update('input')
  .digest('hex');
```

### Timing-Safe Buffer Comparison

```typescript
// Constant-time comparison for token verification
protected verifyToken(provided: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(this.config.token);

  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
```

**Why not `===`:** String equality short-circuits on first mismatch. An attacker can measure response times to guess tokens character by character. XOR comparison always processes every byte.

## Handler Type Patterns

CoorChat defines callback types for the Set-based handler system:

```typescript
// Handler type aliases
type MessageHandler = (message: Message) => void | Promise<void>;
type ErrorHandler = (error: Error) => void | Promise<void>;
type ConnectionStateHandler = (
  newState: ConnectionStatus,
  previousState: ConnectionStatus
) => void | Promise<void>;

// Registration returns unregister function
onMessage(handler: MessageHandler): () => void;
onError(handler: ErrorHandler): () => void;
onConnectionStateChange(handler: ConnectionStateHandler): () => void;
```

**Pattern:** Handlers accept `void | Promise<void>` to support both sync and async callbacks. The `safeCall` wrapper handles both cases. See the **typescript** skill for type inference patterns.

## Configuration Types

```typescript
// Channel config uses discriminated unions — see the zod skill
interface ChannelConfig {
  type: 'redis' | 'discord' | 'slack' | 'signalr';
  token: string;
  connectionParams: Record<string, unknown>;
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    baseDelayMs: number;
  };
  heartbeat?: {
    enabled: boolean;
    intervalMs: number;
  };
}
```

### WARNING: Using `any` for Config Objects

**The Problem:**

```typescript
// BAD — defeats TypeScript's purpose
function createChannel(config: any) {
  return new SlackChannel(config);
}
```

**Why This Breaks:** No compile-time validation. Missing fields cause runtime crashes instead of build-time errors.

**The Fix:**

```typescript
// GOOD — validated at both compile and runtime
import { ChannelConfigSchema } from '@/config/ConfigValidator.js';

function createChannel(config: unknown) {
  const validated = ChannelConfigSchema.parse(config);
  return ChannelFactory.create(validated);
}
```

See the **zod** skill for schema definitions.

## Enum Runtime Values

```typescript
// TypeScript enum
enum MessageType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  DIRECT_MESSAGE = 'direct_message',
  BROADCAST = 'broadcast',
  HEARTBEAT = 'heartbeat',
}

enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}
```

### WARNING: Comparing Enum Names Instead of Values

**The Problem:**

```typescript
// BAD — compares against the enum member name
if (msg.messageType === 'TASK_ASSIGNED') { /* never true at runtime */ }
```

**Why This Breaks:** The JSON wire format uses `'task_assigned'` (lowercase snake_case), not the TypeScript enum member name. This comparison silently fails.

**The Fix:**

```typescript
// GOOD — use the enum value directly
if (msg.messageType === MessageType.TASK_ASSIGNED) { /* works */ }

// Or compare the string value explicitly
if (msg.messageType === 'task_assigned') { /* also works */ }
```

## Async Return Types

```typescript
// Connection methods return Promise<void>
async connect(): Promise<void>;
async disconnect(): Promise<void>;

// Send returns void (fire-and-forget internally)
async sendMessage(message: Message): Promise<void>;

// Queries return typed results
async getHistory(limit?: number): Promise<Message[]>;
async ping(): Promise<boolean>;

// Status is a synchronous getter, not async
get status(): ConnectionStatus;  // NOT getStatus()
```

### WARNING: Calling `channel.getStatus()`

**The Problem:**

```typescript
// BAD — method doesn't exist
const status = channel.getStatus();
```

**Why This Breaks:** `status` is a getter property on ChannelAdapter, not a method. This throws `TypeError: channel.getStatus is not a function`.

**The Fix:**

```typescript
// GOOD — property access
const status = channel.status;
```
