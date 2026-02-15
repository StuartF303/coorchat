# Quickstart Guide: Agent Command Interface

**Feature**: Agent Command Interface
**Audience**: Developers implementing or extending the command system
**Prerequisites**: TypeScript, Node.js 18+, familiarity with Slack APIs

---

## Developer Setup

### 1. Install Dependencies

All required dependencies are already in the project:

```bash
cd packages/mcp-server
npm install
```

**Key packages**:
- `@slack/socket-mode` - Slack real-time messaging
- `@slack/web-api` - Slack Web API client
- `winston` - Logging
- `zod` - Runtime validation
- `vitest` - Testing framework

### 2. Configure Environment

Create or update `.env`:

```bash
# Slack credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_CHANNEL_ID=C0AF0RAG8R3

# Agent configuration
AGENT_ID=T14
AGENT_ROLE=developer
```

### 3. Run Development Server

```bash
npm run dev
```

This starts the server with auto-reload on file changes.

### 4. Test in Slack

Send a message to your configured Slack channel:

```
ping
```

Expected response:
```
pong - T14
```

---

## Project Structure

```
packages/mcp-server/src/
├── commands/                    # NEW: Command interface system
│   ├── CommandParser.ts         # Parse text → Command objects
│   ├── CommandRegistry.ts       # Register and dispatch commands
│   ├── handlers/                # Category-specific handlers
│   │   ├── DiscoveryCommands.ts
│   │   ├── CommunicationCommands.ts
│   │   ├── QueueCommands.ts
│   │   ├── ConfigCommands.ts
│   │   ├── MonitoringCommands.ts
│   │   └── SystemCommands.ts
│   ├── formatters/              # Slack response formatting
│   │   ├── SlackFormatter.ts
│   │   └── ResponseBuilder.ts
│   └── types.ts                 # Core type definitions
│
├── agents/                      # EXISTING: Extend for commands
│   ├── Agent.ts
│   ├── AgentRegistry.ts
│   └── AgentConfig.ts           # NEW: Config persistence
│
├── tasks/                       # EXISTING: Extend for queue mgmt
│   ├── TaskQueue.ts
│   ├── TaskManager.ts
│   └── TaskMetrics.ts           # NEW: Metrics tracking
│
└── index.ts                     # EXISTING: Initialize CommandRegistry
```

---

## Adding a New Command

### Step 1: Define Command in Schema

Edit `specs/001-agent-command-interface/contracts/commands.schema.json`:

```json
{
  "commands": {
    "your_category": {
      "your_command": {
        "aliases": ["alt syntax"],
        "description": "What the command does",
        "syntax": "command <required> [optional]",
        "minArgs": 1,
        "maxArgs": 2,
        "parameters": {
          "paramName": {
            "type": "string",
            "required": true,
            "pattern": "^[A-Z]+$",
            "description": "Parameter description"
          }
        },
        "examples": ["command T14", "command T14 value"],
        "response": {
          "format": "table",
          "columns": ["Col1", "Col2"]
        }
      }
    }
  }
}
```

### Step 2: Add Handler to Category File

Edit `src/commands/handlers/YourCategoryCommands.ts`:

```typescript
import { CommandDef } from '../types';
import { SlackFormatter } from '../formatters/SlackFormatter';

export const yourCommand: CommandDef = {
  minArgs: 1,
  maxArgs: 2,
  description: 'What the command does',
  aliases: ['alt syntax'],
  examples: ['command T14', 'command T14 value'],

  execute: async (tokens, userId, channel, registry) => {
    // Extract parameters
    const param1 = tokens[1];
    const param2 = tokens[2];  // Optional

    // Validate
    if (!isValid(param1)) {
      throw new Error(`Invalid param1: ${param1}`);
    }

    // Execute logic
    const result = await doSomething(param1, param2);

    // Format response
    const formatter = new SlackFormatter(channel);
    await formatter.sendConfirmation(
      `Operation successful: ${result}`
    );
  },
};
```

### Step 3: Register in CommandRegistry

Edit `src/commands/CommandRegistry.ts`:

```typescript
import { yourCommand } from './handlers/YourCategoryCommands';

class CommandRegistry {
  constructor() {
    // ... existing commands
    this.commands.set('your-command', yourCommand);
  }
}
```

### Step 4: Write Tests

Create `tests/unit/commands/YourCommand.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { yourCommand } from '../../../src/commands/handlers/YourCategoryCommands';

describe('yourCommand', () => {
  let mockChannel: any;
  let mockRegistry: any;

  beforeEach(() => {
    mockChannel = {
      sendText: vi.fn().mockResolvedValue(undefined),
    };
    mockRegistry = {
      getAgent: vi.fn(),
    };
  });

  it('should execute successfully with valid params', async () => {
    const tokens = ['your-command', 'param1', 'param2'];
    const userId = 'U123';

    await yourCommand.execute(tokens, userId, mockChannel, mockRegistry);

    expect(mockChannel.sendText).toHaveBeenCalledWith(
      expect.stringContaining('Operation successful')
    );
  });

  it('should throw error for invalid params', async () => {
    const tokens = ['your-command', 'INVALID'];
    const userId = 'U123';

    await expect(
      yourCommand.execute(tokens, userId, mockChannel, mockRegistry)
    ).rejects.toThrow('Invalid param1');
  });
});
```

### Step 5: Run Tests

```bash
npm test -- YourCommand.test.ts
```

---

## Testing Commands

### Unit Tests

Test individual command handlers in isolation:

```bash
# Run all command tests
npm test -- commands/

# Run specific category
npm test -- DiscoveryCommands.test.ts

# Watch mode for development
npm test -- --watch
```

### Integration Tests

Test full command flow (parsing → execution → response):

```bash
npm run test:integration
```

### Manual Testing in Slack

1. Start dev server: `npm run dev`
2. Send command in Slack channel
3. Verify response format and content
4. Check server logs for errors

---

## Debugging Tips

### Enable Debug Logging

Edit `.env`:

```bash
LOG_LEVEL=debug
```

Restart server to see detailed logs.

### Inspect Command Parsing

Add console.log in `CommandParser.ts`:

```typescript
parse(text: string): Command {
  const tokens = text.trim().split(/\s+/);
  console.log('🔍 Parsed tokens:', tokens);  // Debug line
  // ... rest of parsing
}
```

### Test Slack Formatting Locally

Create a test script:

```typescript
import { SlackFormatter } from './src/commands/formatters/SlackFormatter';

const mockChannel = {
  sendText: async (text: string) => console.log('📤', text),
};

const formatter = new SlackFormatter(mockChannel);

// Test table formatting
await formatter.sendTable(
  ['Agent ID', 'Role', 'Status'],
  [
    ['T14', 'developer', 'idle'],
    ['T15', 'tester', 'busy'],
  ]
);
```

Run with:

```bash
tsx debug-formatter.ts
```

### Verify Config Persistence

Check config file location:

```bash
# Linux/macOS
cat ~/.config/coorchat/config.json

# Windows
type %APPDATA%\coorchat\config.json
```

---

## Common Patterns

### 1. Validating Agent Existence

```typescript
const agent = registry.getAgent(agentId);
if (!agent) {
  throw new Error(
    `Agent ${agentId} not found. Use 'list agents' to see connected agents.`
  );
}
```

### 2. Checking Queue Capacity

```typescript
const queue = taskManager.getQueue(agentId);
if (queue.isFull()) {
  throw new Error(
    `Agent ${agentId} queue is full (${queue.size}/${queue.limit}). ` +
    `Increase limit with: config ${agentId} queue-limit <number>`
  );
}
```

### 3. Formatting Success Responses

```typescript
await formatter.sendConfirmation(
  `Agent ${agentId} model changed to ${newModel}`
);
```

### 4. Formatting Error Responses

```typescript
await formatter.sendError({
  code: 'AGENT_NOT_FOUND',
  message: `Agent ${agentId} not found`,
  suggestion: `Use 'list agents' to see connected agents`,
});
```

### 5. Handling Timeouts

```typescript
const response = await waitForResponse(agentId, 30000);
if (!response) {
  await formatter.sendWarning(
    `Agent ${agentId} did not respond (may be disconnected)`
  );
  return;
}
```

---

## Performance Considerations

### Command Parsing

- **Target**: <10ms for any command
- **Implementation**: Use Map lookups (O(1)) instead of array iteration
- **Profiling**: Add timing logs in CommandParser

### Slack API Rate Limits

- **Tier 2 methods**: 20 requests per minute
- **Tier 3 methods**: 50 requests per minute
- **Mitigation**: Batch updates, use Block Kit for rich formatting

### Config File I/O

- **Pattern**: Atomic writes (write-to-temp + rename)
- **Performance**: Async operations, no blocking
- **Location**: Use SSD-backed config directory

### Memory Usage

- **Commands**: Stateless handlers (no memory overhead)
- **Metrics**: In-memory with periodic persistence
- **Tasks**: Limit queue depth per agent (default 50)

---

## Code Style Guidelines

### Naming Conventions

- **Commands**: lowercase_with_underscores (e.g., `list_agents`)
- **Handlers**: camelCase functions (e.g., `handleListAgents`)
- **Types**: PascalCase (e.g., `CommandType`, `AgentConfig`)
- **Enums**: SCREAMING_SNAKE_CASE (e.g., `CommandType.DISCOVERY`)

### Error Messages

- **Format**: `❌ Error: <message> (Code: <ERROR_CODE>)`
- **Tone**: User-friendly, actionable
- **Examples**:
  - ✅ "Agent T14 not found. Use 'list agents' to see connected agents."
  - ❌ "ENOENT: No such agent in registry"

### Success Messages

- **Format**: `✅ <message>`
- **Brevity**: One line when possible
- **Examples**:
  - ✅ "Agent T14 model changed to opus"
  - ❌ "Successfully updated the agent configuration model field to opus for agent T14"

---

## Troubleshooting

### Command Not Recognized

**Symptom**: "Unknown command: xyz"

**Fixes**:
1. Check command name in `CommandRegistry`
2. Verify aliases in command definition
3. Ensure case-insensitive matching (`.toLowerCase()`)

### Agent Not Found Errors

**Symptom**: "Agent T14 not found"

**Fixes**:
1. Check agent is connected: `list agents`
2. Verify agent ID format (uppercase alphanumeric)
3. Check AgentRegistry initialization in `index.ts`

### Config Not Persisting

**Symptom**: Config resets after restart

**Fixes**:
1. Check file permissions: `ls -la ~/.config/coorchat/`
2. Verify atomic write implementation
3. Check disk space: `df -h`

### Slack Formatting Issues

**Symptom**: Tables don't render or text is cut off

**Fixes**:
1. Check character limits (40,000 for text, 90 rows for tables)
2. Verify Block Kit JSON structure
3. Test with Block Kit Builder: https://app.slack.com/block-kit-builder

---

## Next Steps

1. **Implement Phase 1**: Create `src/commands/` directory structure
2. **Add Tests**: Write unit tests for each handler
3. **Integration**: Connect to existing SlackChannel in `index.ts`
4. **Deploy**: Test with real Slack workspace
5. **Monitor**: Track command usage metrics

---

## Resources

- **Spec**: [spec.md](./spec.md) - Full requirements
- **Research**: [research.md](./research.md) - Technical decisions
- **Data Model**: [data-model.md](./data-model.md) - Entity definitions
- **Contracts**: [contracts/commands.schema.json](./contracts/commands.schema.json) - Command schemas
- **Slack Block Kit**: https://api.slack.com/block-kit
- **Vitest Docs**: https://vitest.dev/
- **Zod Docs**: https://zod.dev/

---

## Questions?

File issues in the project repo or discuss in the team Slack channel.
