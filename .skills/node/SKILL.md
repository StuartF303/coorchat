---
name: node
description: |
  Manages Node.js 18+ runtime, ES modules, and MCP server execution for the CoorChat coordination platform.
  Use when: configuring ES module imports, managing process lifecycle, handling signals/shutdown, using Node.js crypto/fs/timers APIs, resolving environment variables, or debugging module resolution issues.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Node Skill

CoorChat runs on Node.js 18+ with strict ES module mode (`"type": "module"` in package.json). All imports require `.js` extensions. The MCP server uses `async main()` with graceful shutdown via SIGINT/SIGTERM. Crypto APIs provide token generation with timing-safe comparison. Configuration flows through `dotenv` + Zod validation.

## Quick Start

### ES Module Imports

```typescript
// ALWAYS include .js extension — Node.js ESM requires it
import { ChannelAdapter } from '../base/ChannelAdapter.js';
import { TokenGenerator } from '@/config/TokenGenerator.js';
import type { Message } from '@/protocol/Message.js';
```

### Process Lifecycle

```typescript
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const channel = new SlackChannel(config);
  await channel.connect();

  const heartbeat = setInterval(() => { /* ... */ }, 15000);

  const shutdown = async () => {
    clearInterval(heartbeat);
    await channel.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await new Promise(() => {}); // Keep alive
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| ESM extensions | All imports need `.js` | `import { X } from './X.js'` |
| Path aliases | `@/*` maps to `./src/*` | `import { Y } from '@/config/Y.js'` |
| Env loading | dotenv first, then access | `dotenv.config(); process.env.VAR` |
| Graceful shutdown | SIGINT + SIGTERM handlers | `process.on('SIGINT', shutdown)` |
| Crypto tokens | `randomBytes` + timing-safe | `randomBytes(32).toString('hex')` |
| Set-based handlers | Not EventEmitter | `channel.onMessage(fn)` returns unregister |
| Top-level async | `main().catch()` pattern | Wraps entire startup in async function |

## Common Patterns

### Secure Token Generation

```typescript
import { randomBytes, createHash } from 'crypto';

const token = 'cct_' + randomBytes(32).toString('hex');
const hash = createHash('sha256').update(token).digest('hex');
```

### Environment Variable Validation

```typescript
const required = ['SHARED_TOKEN', 'CHANNEL_TYPE'];
const missing = required.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('Missing:', missing.join(', '));
  process.exit(1);
}
```

### Timer Cleanup

```typescript
// ALWAYS clear timers on shutdown — leaked timers keep the process alive
const timer = setInterval(doWork, 15000);
// On shutdown:
clearInterval(timer);
```

## WARNING: Common ESM Mistakes

**Missing `.js` extension** causes `ERR_MODULE_NOT_FOUND` at runtime even though TypeScript compiles fine. The TypeScript compiler does NOT add extensions to output.

```typescript
// BAD — compiles but crashes at runtime
import { Foo } from './Foo';

// GOOD
import { Foo } from './Foo.js';
```

## See Also

- [patterns](references/patterns.md) - Async patterns, startup flow, handler management
- [types](references/types.md) - Type patterns for Node.js APIs
- [modules](references/modules.md) - ES module configuration and resolution
- [errors](references/errors.md) - Error handling and process exit patterns

## Related Skills

- See the **typescript** skill for strict mode, Zod schemas, and type patterns
- See the **vitest** skill for testing async Node.js code
- See the **redis** skill for ioredis pub/sub channel adapter
- See the **discord** skill for Discord.js bot integration
- See the **slack** skill for Slack Socket Mode + Web API
- See the **signalr** skill for @microsoft/signalr client connection
- See the **winston** skill for structured JSON logging
- See the **zod** skill for configuration validation schemas
- See the **docker** skill for containerized Redis/relay server

## Documentation Resources

> Fetch latest Node.js documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "node"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/nodejs_api` _(resolve using mcp__context7__resolve-library-id, prefer /websites/ when available)_

**Recommended Queries:**
- "ES modules import resolution"
- "crypto randomBytes createHash"
- "process signals graceful shutdown"
- "timers setInterval setTimeout cleanup"
