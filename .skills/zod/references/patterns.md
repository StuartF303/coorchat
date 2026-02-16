# Zod Patterns Reference

## Contents
- Discriminated Unions for Channel Routing
- Schema-to-Type Inference
- Defaults and Constraints
- Nested Optional Objects
- Singleton Validator Pattern
- Anti-Patterns

---

## Discriminated Unions for Channel Routing

The core architectural pattern in this project. `z.discriminatedUnion` narrows `connectionParams` based on the `type` field, giving TypeScript full type safety per channel.

```typescript
// From src/config/ConfigValidator.ts
export const ChannelConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('discord'),
    token: z.string().min(1),
    connectionParams: DiscordConfigSchema,
    retry: RetryConfigSchema.optional(),
    heartbeat: HeartbeatConfigSchema.optional(),
  }),
  z.object({
    type: z.literal('redis'),
    token: z.string().min(1),
    connectionParams: RedisConfigSchema,
    retry: RetryConfigSchema.optional(),
    heartbeat: HeartbeatConfigSchema.optional(),
  }),
  // ... signalr, relay, slack variants
]);
```

**Why discriminated unions instead of `z.union`?** Zod can check the `type` field first and skip irrelevant branches. With `z.union`, every branch is tried sequentially, producing confusing compound error messages.

---

## Schema-to-Type Inference

**ALWAYS use `z.output`** in this project. Every schema exports its type this way:

```typescript
export type RetryConfig = z.output<typeof RetryConfigSchema>;
export type ChannelConfig = z.output<typeof ChannelConfigSchema>;
export type AppConfig = z.output<typeof AppConfigSchema>;
```

### WARNING: z.infer vs z.output vs z.input

**The Problem:**

```typescript
// BAD - z.infer is an alias for z.output, but misleading when defaults exist
type Config = z.infer<typeof RetryConfigSchema>;
// This IS the output type (with defaults applied), but the name suggests input
```

**Why This Matters:**
1. `z.output` = type **after** parsing (defaults applied, transforms run)
2. `z.input` = type **before** parsing (defaults are optional, no transforms)
3. `z.infer` = alias for `z.output` - works but is ambiguous

**The Fix:**

```typescript
// GOOD - explicit about which side of parsing you mean
type RetryConfig = z.output<typeof RetryConfigSchema>;  // After parse: enabled is boolean
type RetryConfigInput = z.input<typeof RetryConfigSchema>;  // Before parse: enabled is boolean | undefined
```

**When You Might Be Tempted:** When you see `z.infer` in tutorials or other codebases. This project standardized on `z.output` for clarity - follow the convention.

---

## Defaults and Constraints

Schemas use `.default()` extensively so configs work with minimal input:

```typescript
export const RedisConfigSchema = z.object({
  host: z.string().min(1).default('localhost'),
  port: z.number().int().positive().default(6379),
  password: z.string().optional(),
  db: z.number().int().min(0).default(0),
  keyPrefix: z.string().default('coorchat:'),
  tls: z.boolean().default(false),
});
```

**Pattern:** Chain constraints before `.default()`. The default value must pass the constraints.

```typescript
// GOOD - constraint then default
z.number().int().positive().default(5)

// BAD - default that violates constraints would throw at schema creation
z.number().int().positive().default(-1)  // Runtime error
```

### Enum Defaults

```typescript
export const LoggingConfigSchema = z.object({
  level: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG']).default('INFO'),
  format: z.enum(['json', 'text']).default('json'),
  output: z.enum(['console', 'file', 'both']).default('console'),
  filePath: z.string().optional(),
});
```

---

## Nested Optional Objects

Agent config shows nested optional objects with their own constraints:

```typescript
export const AgentConfigSchema = z.object({
  role: z.string().min(1).max(50),
  platform: z.enum(['Linux', 'macOS', 'Windows']),
  environment: z.string().min(1).max(100),
  tools: z.array(z.string()).min(1),
  languages: z.array(z.string()).optional(),
  resourceLimits: z.object({
    apiQuotaPerHour: z.number().int().nonnegative().optional(),
    maxConcurrentTasks: z.number().int().min(1).max(10).default(1),
    rateLimitPerMinute: z.number().int().nonnegative().optional(),
  }).optional(),
});
```

**Key:** When `resourceLimits` is provided, its inner fields still get defaults. When omitted entirely, the whole object is `undefined`.

---

## Singleton Validator Pattern

The project exports a singleton `ConfigValidator` instance with convenience functions:

```typescript
// Singleton instance
export const validator = new ConfigValidator();

// Convenience functions that throw on failure
export function validateAppConfig(data: unknown): AppConfig {
  return validator.validateOrThrow(AppConfigSchema, data);
}

export function validateChannelConfig(data: unknown): ChannelConfig {
  return validator.validateOrThrow(ChannelConfigSchema, data);
}
```

**Two validation modes:**

| Method | Returns | Use When |
|--------|---------|----------|
| `validator.validate(schema, data)` | `ValidationResult<T>` | Graceful error handling (config loading) |
| `validator.validateOrThrow(schema, data)` | `T` (or throws) | Fail-fast (CLI, startup) |

---

## Anti-Patterns

### WARNING: Using Zod for Message Protocol Validation

**The Problem:**

```typescript
// BAD - Don't create Zod schemas for protocol messages
const MessageSchema = z.object({
  protocolVersion: z.string().regex(/^\d+\.\d+$/),
  messageType: z.enum(['task_assigned', 'heartbeat', ...]),
  senderId: z.string().uuid(),
});
```

**Why This Breaks:**
1. Message protocol validation uses **AJV with JSON Schema** (`MessageValidator.ts`) - the schema is defined in a language-agnostic JSON Schema format
2. Duplicating validation in Zod creates two sources of truth that will drift
3. JSON Schema can be shared with the C# relay server; Zod schemas cannot

**The Fix:**

```typescript
// GOOD - Use the existing AJV-based MessageValidator
import { validator } from '@/protocol/MessageValidator.js';

const result = validator.validateFull(parsedMessage);
if (!result.valid) {
  logger.warn('Invalid message', { errors: result.errors });
}
```

**When You Might Be Tempted:** When adding a new message type field. Edit the JSON Schema in `MessageValidator.ts` instead.

### WARNING: Skipping safeParse for User-Facing Config

**The Problem:**

```typescript
// BAD - parse() throws ZodError with ugly stack trace
const config = AppConfigSchema.parse(userProvidedConfig);
```

**Why This Breaks:**
1. `ZodError` messages are developer-facing, not user-facing
2. Stack traces confuse end users loading config files
3. No opportunity to suggest fixes or show which field failed

**The Fix:**

```typescript
// GOOD - safeParse with formatted errors
const result = validator.validateAppConfig(data);
if (!result.success) {
  const messages = validator.formatErrors(result.errors!);
  // ["channel.type: Invalid discriminator value", "agent.role: Required"]
  console.error('Configuration errors:');
  messages.forEach(msg => console.error(`  - ${msg}`));
  process.exit(1);
}
```

### WARNING: Inline Schema Definitions

**The Problem:**

```typescript
// BAD - schema defined at point of use, not reusable or testable
function loadConfig(data: unknown) {
  const parsed = z.object({
    host: z.string(),
    port: z.number(),
  }).parse(data);
}
```

**Why This Breaks:**
1. Can't export a type from an inline schema
2. Can't reuse the schema for partial validation
3. Can't reference it in discriminated unions

**The Fix:**

```typescript
// GOOD - define in ConfigValidator.ts, export schema AND type
export const RedisConfigSchema = z.object({
  host: z.string().min(1).default('localhost'),
  port: z.number().int().positive().default(6379),
});
export type RedisConfig = z.output<typeof RedisConfigSchema>;
```
