# Node.js Modules Reference

## Contents
- ESM Configuration
- Import Extension Rules
- Import Order Convention
- Path Aliases
- Dynamic Imports
- Node.js Built-in Modules Used
- Package Dependencies
- Module Singletons
- Anti-Patterns

## ESM Configuration

CoorChat uses strict ES modules. Two files control this:

**package.json:**
```json
{
  "type": "module",
  "engines": { "node": ">=18.0.0" },
  "main": "dist/index.js",
  "bin": { "coorchat": "dist/cli/index.js" }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`"type": "module"` makes every `.js` file in the package an ES module. No `.mjs` extensions needed.

## Import Extension Rules

**Every relative import MUST include `.js` extension.** TypeScript compiles `.ts` to `.js` but does NOT rewrite import paths.

```typescript
// GOOD — explicit .js extension
import { ChannelAdapter } from '../base/ChannelAdapter.js';
import { TokenGenerator } from '@/config/TokenGenerator.js';
import type { Message } from '@/protocol/Message.js';

// BAD — runtime ERR_MODULE_NOT_FOUND
import { ChannelAdapter } from '../base/ChannelAdapter';
import { TokenGenerator } from '@/config/TokenGenerator';
```

**Third-party packages don't need extensions:**
```typescript
import * as dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
```

## Import Order Convention

```typescript
// 1. Node.js stdlib
import { randomBytes, createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';

// 2. Third-party dependencies
import * as dotenv from 'dotenv';
import { WebClient } from '@slack/web-api';
import Redis from 'ioredis';

// 3. Type-only imports (separate for clarity)
import type { ChannelConfig } from '../channels/base/Channel.js';
import type { Message } from '@/protocol/Message.js';

// 4. Local imports
import { ChannelAdapter } from '../base/ChannelAdapter.js';
import { logger } from '@/logging/Logger.js';
```

**Why separate type imports:** `import type` is erased at compile time. Grouping them makes it clear which imports have runtime effects and which are compile-time only. See the **typescript** skill for type import details.

## Path Aliases

The `@/*` alias maps to `./src/*` via tsconfig paths and `tsc-alias` post-compilation.

```typescript
// These are equivalent:
import { logger } from '@/logging/Logger.js';
import { logger } from '../../logging/Logger.js';
```

`tsc-alias` runs after `tsc` to rewrite `@/` paths to relative paths in the compiled output. The build command is:

```bash
tsc && tsc-alias
```

### WARNING: Missing tsc-alias Step

**The Problem:**

```bash
# BAD — compiled JS still has @/ paths that Node.js can't resolve
tsc
node dist/index.js  # Error: Cannot find module '@/config/...'
```

**Why This Breaks:** TypeScript's `paths` config only affects compilation, not output. Node.js doesn't understand `@/` imports.

**The Fix:**

```bash
# GOOD — tsc-alias rewrites paths after compilation
tsc && tsc-alias
node dist/index.js  # Works — paths are now relative
```

## Dynamic Imports

Used in `src/index.ts` for lazy module loading during startup:

```typescript
async function main() {
  // Modules loaded only when needed
  const { CommandRegistry } = await import('./commands/CommandRegistry.js');
  const { AgentRegistry } = await import('./agents/AgentRegistry.js');
  const { TaskManager } = await import('./tasks/TaskManager.js');
}
```

**When to use:** Startup code that conditionally loads modules based on config (e.g., only load Slack modules when `CHANNEL_TYPE=slack`).

## Node.js Built-in Modules Used

| Module | Usage | Location |
|--------|-------|----------|
| `crypto` | Token generation, hashing, timing-safe compare | `src/config/TokenGenerator.ts` |
| `fs` | Config file loading (`readFileSync`, `existsSync`) | `src/config/ConfigLoader.ts` |
| `path` | File path resolution | Config loading |
| `events` | NOT used — CoorChat uses Set-based handlers | — |

**Note:** CoorChat deliberately avoids `EventEmitter` in favor of Set-based handler management. See [patterns.md](patterns.md) for the rationale.

## Package Dependencies

Key runtime dependencies and their Node.js integration:

| Package | Purpose | Node.js API |
|---------|---------|-------------|
| `dotenv` | Load `.env` into `process.env` | `process.env` |
| `commander` | CLI argument parsing | `process.argv` |
| `ioredis` | Redis pub/sub | See **redis** skill |
| `discord.js` | Discord bot | See **discord** skill |
| `@slack/web-api` | Slack messaging | See **slack** skill |
| `@microsoft/signalr` | SignalR client | See **signalr** skill |
| `winston` | Structured logging | See **winston** skill |
| `zod` | Schema validation | See **zod** skill |
| `uuid` | UUID v4 generation | — |

## Module Singletons

ES modules are evaluated once. Exported instances are shared across all importers:

```typescript
// src/logging/Logger.ts
export const logger = createLogger();

// src/config/ConfigValidator.ts
export const validator = new ConfigValidator();

// src/config/EnvironmentResolver.ts
export const resolver = new EnvironmentResolver();
```

```typescript
// Any file — gets the same instance
import { logger } from '@/logging/Logger.js';
import { validator } from '@/config/ConfigValidator.js';
```

**No getInstance() needed.** ESM guarantees a module executes only once per process. The exported reference is inherently a singleton.

### WARNING: CommonJS Require in ESM Package

**The Problem:**

```typescript
// BAD — SyntaxError in ESM package
const dotenv = require('dotenv');
```

**Why This Breaks:** When `"type": "module"` is set, `require()` is not available. Node.js throws `ReferenceError: require is not defined`.

**The Fix:**

```typescript
// GOOD — ES module import
import * as dotenv from 'dotenv';

// Or for default exports
import Redis from 'ioredis';
```

### WARNING: Circular Module Dependencies

**The Problem:**

```typescript
// A.ts imports B.ts, B.ts imports A.ts
// One module gets an incomplete export object
```

**Why This Breaks:** ESM handles circular deps differently than CJS. One module will see `undefined` for imports that haven't been evaluated yet. This causes subtle runtime bugs.

**When You Might Be Tempted:** When a utility module needs a type from a domain module that imports the utility. Fix with `import type` (type-only imports are erased and don't create runtime cycles) or restructure to break the cycle.
