# Zod Workflows Reference

## Contents
- Config Validation Pipeline
- Adding a New Schema
- Environment Variable Resolution
- Error Handling Strategies
- Testing Zod Schemas

---

## Config Validation Pipeline

Configuration flows through three stages before reaching application code. Zod is the final gate.

```
Config File (JSON/YAML)
  |
  v
EnvironmentResolver.resolve()     # Replace ${VAR} placeholders
  |
  v
JSON.parse() / YAML.parse()       # Parse to object
  |
  v
ConfigValidator.validate()        # Zod schema validation
  |
  v
Typed Config (AppConfig)           # Safe to use
```

**From `ConfigLoader.ts`:**

```typescript
export class ConfigLoader {
  load<T>(filePath: string, options: LoadOptions = {}): T {
    let content = readFileSync(filePath, encoding);

    // Step 1: Resolve ${VAR:-default} placeholders
    if (options.resolveEnv) {
      content = this.resolver.resolve(content);
    }

    // Step 2: Parse format
    const config = this.parse(content, format);

    // Step 3: Merge with defaults, then validate with Zod
    return this.mergeDeep(defaults, config) as T;
  }
}
```

**Key insight:** Environment variable substitution happens on raw strings **before** Zod parsing. This means `${REDIS_PORT:-6379}` becomes `"6379"` (a string), and Zod's `.default()` only applies if the field is missing entirely, not if it's an empty string.

---

## Adding a New Schema

Copy this checklist when adding a new configuration schema:

- [ ] Step 1: Define schema in `src/config/ConfigValidator.ts`
- [ ] Step 2: Export type with `z.output<typeof Schema>`
- [ ] Step 3: If channel-specific, add variant to `ChannelConfigSchema` discriminated union
- [ ] Step 4: Add convenience method to `ConfigValidator` class
- [ ] Step 5: Add environment variables to `.env.example`
- [ ] Step 6: Document variables in `CLAUDE.md` environment table

### Step-by-Step Example: Adding Webhook Config

```typescript
// Step 1: Define schema
export const WebhookConfigSchema = z.object({
  port: z.number().int().positive().default(3000),
  path: z.string().min(1).default('/webhook'),
  secret: z.string().min(16),
  maxPayloadSize: z.number().int().positive().default(1048576), // 1MB
});

// Step 2: Export type
export type WebhookConfig = z.output<typeof WebhookConfigSchema>;

// Step 4: Add convenience method
validateWebhookConfig(data: unknown): ValidationResult<WebhookConfig> {
  return this.validate(WebhookConfigSchema, data);
}
```

### Validation Loop

When iterating on schema design:

1. Define schema with constraints and defaults
2. Validate: `npm test -- --run` (see the **vitest** skill)
3. If tests fail on unexpected validation errors, check constraint order
4. Only proceed when all config scenarios pass

---

## Environment Variable Resolution

Environment variables are resolved **before** Zod validation. The `EnvironmentResolver` supports three syntaxes:

| Syntax | Behavior | Example |
|--------|----------|---------|
| `${VAR}` | Simple substitution | `${REDIS_HOST}` |
| `${VAR:-default}` | Default if undefined | `${REDIS_HOST:-localhost}` |
| `${VAR:?error}` | Throw if undefined | `${SHARED_TOKEN:?Token required}` |

**From `EnvironmentResolver.ts`:**

```typescript
export class EnvironmentResolver {
  resolve(input: string, depth: number = 0): string {
    return input.replace(
      /\$\{([^}:]+)(?:([:-])([^}]+))?\}/g,
      (match, varName, operator, operand) => {
        const value = this.options.env[varName.trim()];

        if (operator === '-') {
          return value !== undefined ? value : operand || '';
        }

        if (operator === '?') {
          if (value === undefined) {
            throw new Error(operand || `Required: ${varName}`);
          }
          return value;
        }

        return value ?? match;
      }
    );
  }
}
```

### WARNING: Type Mismatch After Env Resolution

**The Problem:**

```json
{
  "port": "${REDIS_PORT:-6379}"
}
```

After env resolution, `port` is the **string** `"6379"`, not the number `6379`. Zod's `z.number()` will reject it.

**Why This Breaks:**
1. Environment variables are always strings
2. JSON preserves the string type from placeholder substitution
3. Zod strict mode rejects type mismatches

**The Fix:**

Use `z.coerce.number()` if accepting env-resolved values directly, or ensure the config loader parses JSON after resolution so numeric literals are preserved. In this project, the `ConfigLoader.parse()` step handles this by re-parsing JSON.

---

## Error Handling Strategies

### Strategy 1: Graceful (Config Loading)

Use when loading user-provided config files. Show all errors at once.

```typescript
const result = validator.validateAppConfig(rawConfig);
if (!result.success) {
  const messages = validator.formatErrors(result.errors!);
  // Output: ["channel.connectionParams.host: String must contain at least 1 character(s)"]

  console.error('Configuration errors:');
  messages.forEach(msg => console.error(`  - ${msg}`));
  process.exit(1);
}

// result.data is typed as AppConfig
startServer(result.data!);
```

### Strategy 2: Fail-Fast (Internal/CLI)

Use when the config source is trusted (CLI args, programmatic construction).

```typescript
try {
  const config = validator.validateOrThrow(ChannelConfigSchema, channelOpts);
  const channel = ChannelFactory.create(config);
} catch (error) {
  // ZodError with .issues array
  if (error instanceof z.ZodError) {
    error.issues.forEach(issue => {
      console.error(`${issue.path.join('.')}: ${issue.message}`);
    });
  }
  process.exit(1);
}
```

### Error Formatting Internals

```typescript
// From ConfigValidator
formatErrors(errors: z.ZodError): string[] {
  return errors.errors.map((err) => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}

getErrorSummary(errors: z.ZodError): string {
  return this.formatErrors(errors).join('; ');
}
```

**Pattern:** `path.join('.')` converts `['channel', 'connectionParams', 'host']` to `"channel.connectionParams.host"` for readable error paths.

---

## Testing Zod Schemas

Zod validation is tested indirectly through integration tests in this project. See the **vitest** skill for test patterns.

### Testing Valid Config

```typescript
import { describe, it, expect } from 'vitest';
import { validator, RedisConfigSchema } from '@/config/ConfigValidator.js';

describe('RedisConfigSchema', () => {
  it('should accept valid config with defaults', () => {
    const result = validator.validate(RedisConfigSchema, {
      host: 'redis.example.com',
      port: 6380,
    });

    expect(result.success).toBe(true);
    expect(result.data?.keyPrefix).toBe('coorchat:');  // default applied
    expect(result.data?.tls).toBe(false);              // default applied
  });
});
```

### Testing Invalid Config

```typescript
it('should reject config with invalid port', () => {
  const result = validator.validate(RedisConfigSchema, {
    host: 'localhost',
    port: -1,  // violates .positive()
  });

  expect(result.success).toBe(false);
  const errors = validator.formatErrors(result.errors!);
  expect(errors).toContainEqual(expect.stringContaining('port'));
});
```

### Testing Discriminated Union

```typescript
it('should narrow connectionParams by channel type', () => {
  const discordConfig = {
    type: 'discord' as const,
    token: 'test-token-minimum-16',
    connectionParams: {
      guildId: '123456789',
      channelId: '987654321',
      botToken: 'discord-bot-token',
    },
  };

  const result = validator.validateChannelConfig(discordConfig);
  expect(result.success).toBe(true);
  // TypeScript knows connectionParams is DiscordConfig here
});

it('should reject mismatched type and connectionParams', () => {
  const badConfig = {
    type: 'discord',
    token: 'test-token-minimum-16',
    connectionParams: {
      hubUrl: 'https://example.com/hub',  // SignalR field, not Discord
      accessToken: 'token',
    },
  };

  const result = validator.validateChannelConfig(badConfig);
  expect(result.success).toBe(false);
});
```

### Testing Checklist

Copy this checklist when adding schema tests:

- [ ] Valid input with all fields
- [ ] Valid input with only required fields (defaults applied)
- [ ] Missing required fields
- [ ] Invalid types (string where number expected)
- [ ] Constraint violations (min, max, positive, url, uuid)
- [ ] Discriminated union type mismatches
- [ ] Empty strings on `.min(1)` fields
- [ ] Nested optional objects: present and absent
