---
name: zod
description: |
  Validates configuration schemas and message protocols using Zod 3.x with TypeScript type inference.
  Use when: defining or modifying configuration schemas, adding new channel types, validating config inputs,
  exporting inferred types with z.output, formatting Zod validation errors, or working with discriminated
  unions for channel routing in packages/mcp-server/src/config/.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Zod Skill

CoorChat uses Zod 3.x exclusively for **configuration validation** (`ConfigValidator.ts`), not message protocol validation (that's AJV with JSON Schema). All schemas live in `packages/mcp-server/src/config/ConfigValidator.ts`, export types via `z.output<typeof Schema>`, and use `z.discriminatedUnion` for channel-type routing.

## Quick Start

### Define a Schema with Defaults

```typescript
import { z } from 'zod';

export const RetryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxAttempts: z.number().int().positive().default(5),
  initialDelayMs: z.number().int().positive().default(1000),
  maxDelayMs: z.number().int().positive().default(60000),
});

export type RetryConfig = z.output<typeof RetryConfigSchema>;
```

### Validate Safely

```typescript
import { validator, ChannelConfigSchema } from '@/config/ConfigValidator.js';

const result = validator.validate(ChannelConfigSchema, data);
if (!result.success) {
  console.error(validator.formatErrors(result.errors!));
}
```

## Key Concepts

| Concept | This Project's Usage | Example |
|---------|---------------------|---------|
| Discriminated union | Channel type routing | `z.discriminatedUnion('type', [...])` |
| `z.output` | All type exports | `type AppConfig = z.output<typeof AppConfigSchema>` |
| `safeParse` | Config validation | `validator.validate()` wraps `safeParse` |
| `parse` (throws) | CLI validation | `validator.validateOrThrow()` wraps `parse` |
| Defaults | Sensible config defaults | `.default('localhost')`, `.default(6379)` |
| Zod vs AJV | Config = Zod, Protocol = AJV | Two tools, two concerns |

## Common Patterns

### Adding a New Channel Type

**When:** Implementing a new channel adapter (e.g., Teams, Matrix).

```typescript
// 1. Define channel-specific schema
export const TeamsConfigSchema = z.object({
  tenantId: z.string().uuid(),
  botId: z.string().min(1),
  appSecret: z.string().min(1),
});

// 2. Add to discriminated union in ChannelConfigSchema
z.object({
  type: z.literal('teams'),
  token: z.string().min(1),
  connectionParams: TeamsConfigSchema,
  retry: RetryConfigSchema.optional(),
  heartbeat: HeartbeatConfigSchema.optional(),
}),

// 3. Export the type
export type TeamsConfig = z.output<typeof TeamsConfigSchema>;
```

### Error Formatting

```typescript
const result = validator.validateAppConfig(rawConfig);
if (!result.success) {
  const messages: string[] = validator.formatErrors(result.errors!);
  // ["channel.type: Invalid discriminator value", "agent.role: String must contain at least 1 character(s)"]
  const summary: string = validator.getErrorSummary(result.errors!);
  // "channel.type: Invalid discriminator value; agent.role: String must contain at least 1 character(s)"
}
```

## See Also

- [patterns](references/patterns.md) - Schema design, discriminated unions, type inference
- [workflows](references/workflows.md) - Validation pipelines, env resolution, testing

## Related Skills

- See the **typescript** skill for strict mode and type inference patterns
- See the **vitest** skill for testing Zod schemas
- See the **node** skill for ES module imports with `.js` extensions

## Documentation Resources

> Fetch latest Zod 3.x documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "zod"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/v3_zod_dev` _(Zod 3.x documentation - matches project's `^3.22.4`)_

**Recommended Queries:**
- "discriminated unions z.discriminatedUnion"
- "safeParse vs parse error handling"
- "z.output vs z.infer vs z.input type inference"
- "default values and optional fields"
