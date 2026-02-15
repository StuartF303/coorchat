# CoorChat CLI Documentation

Command-line interface for managing CoorChat agents, tokens, and monitoring coordination.

## Installation

```bash
# From source
cd packages/mcp-server
npm install
npm run build

# Use locally
npm run cli -- <command>

# Or install globally
npm install -g .
coorchat <command>
```

## Commands

### Token Management

#### `token generate`

Generate secure authentication tokens.

```bash
# Generate channel token (default)
npm run cli -- token generate

# Generate API token
npm run cli -- token generate --type api

# Generate webhook secret
npm run cli -- token generate --type webhook

# Generate multiple tokens
npm run cli -- token generate --count 5
```

**Options**:
- `-t, --type <type>`: Token type (`channel`, `api`, `webhook`) - default: `channel`
- `-c, --count <count>`: Number of tokens to generate - default: `1`

**Output**:
```
Generated tokens:
1. cct_a3f8d9e2c1b4f7a6e8d2c9b1f4a7e3d2c6b9f1e4a8d3c7b2f5e9a1d4c8b3f6

Add to your .env file:
SHARED_TOKEN=cct_a3f8d9e2c1b4f7a6e8d2c9b1f4a7e3d2c6b9f1e4a8d3c7b2f5e9a1d4c8b3f6
```

#### `token validate <token>`

Validate token format and security requirements.

```bash
npm run cli -- token validate cct_abc123def456
```

**Output**:
```
✅ Token is valid
Length: 71 characters
Type: Channel Token
```

#### `token hash <token>`

Generate SHA-256 hash of a token for secure storage.

```bash
npm run cli -- token hash cct_your_token
```

**Output**:
```
Token hash:
9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

---

### Agent Management

#### `agent start`

Start an agent and connect to the coordination channel.

```bash
# Start with defaults
npm run cli -- agent start

# Specify role
npm run cli -- agent start --role tester

# Specify agent ID
npm run cli -- agent start --id my-agent-1 --role developer

# Specify channel type
npm run cli -- agent start --channel discord --role architect
```

**Options**:
- `-i, --id <id>`: Agent ID (default: auto-generated)
- `-r, --role <role>`: Agent role (default: `developer`)
- `-c, --channel <channel>`: Channel type (default: from env or `redis`)

**Example**:
```bash
SHARED_TOKEN=cct_your_token \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
npm run cli -- agent start --role developer
```

**Output**:
```
🤖 Starting agent: agent-1708012345678
   Role: developer
   Channel: redis

✅ Connected to channel

Agent is running. Press Ctrl+C to stop.

📨 [TASK_ASSIGNED] from task-queue
   {
     "taskId": "issue-123",
     "description": "Implement authentication"
   }
```

#### `agent list`

List all active agents (requires shared state store).

```bash
npm run cli -- agent list
```

---

### Role Management

#### `role list`

List all available predefined roles and their capabilities.

```bash
npm run cli -- role list
```

**Output**:
```
📋 Available Roles:

developer:
  Description: Software developer for implementing features
  Capabilities: coding, debugging, code-review, git-operations

tester:
  Description: Quality assurance and testing specialist
  Capabilities: testing, test-automation, quality-assurance, bug-reporting

architect:
  Description: System architect for design and architecture decisions
  Capabilities: architecture-design, system-design, technical-planning

... (8 total roles)
```

#### `role suggest <capability...>`

Suggest roles based on required capabilities.

```bash
npm run cli -- role suggest testing code-review

npm run cli -- role suggest security penetration-testing
```

**Output**:
```
💡 Suggested Roles:

1. tester
   Quality assurance and testing specialist

2. developer
   Software developer for implementing features
```

---

### Configuration

#### `config show`

Display current configuration from environment variables.

```bash
npm run cli -- config show
```

**Output**:
```
⚙️  Current Configuration:

Channel Type: redis
Agent ID: agent-claude-1
Agent Role: developer
Shared Token: ***b3f6a1d4

Redis Configuration:
  Host: localhost
  Port: 6379
  TLS: false

GitHub Integration:
  Token: ***ab12cd34
  Owner: your-org
  Repo: your-repo
```

#### `config init`

Generate a configuration template.

```bash
# Generate for Redis
npm run cli -- config init --channel redis

# Generate for Discord
npm run cli -- config init --channel discord

# Generate for SignalR
npm run cli -- config init --channel signalr
```

**Output**:
```
# CoorChat Configuration
# Generated: 2026-02-15T00:00:00.000Z

# Shared authentication token (use same token for all agents)
SHARED_TOKEN=cct_a3f8d9e2c1b4f7a6e8d2c9b1f4a7e3d2

# Channel configuration
CHANNEL_TYPE=redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TLS=false

# Agent configuration
AGENT_ID=agent-1708012345678
AGENT_ROLE=developer

# Optional: GitHub integration
# GITHUB_TOKEN=ghp_your_token_here
# GITHUB_OWNER=your-org
# GITHUB_REPO=your-repo

# Logging
LOG_LEVEL=info

💾 Save this to .env file in packages/mcp-server/
```

---

### Monitoring

#### `monitor`

Monitor real-time agent coordination activity.

```bash
npm run cli -- monitor

# Specify channel
CHANNEL_TYPE=discord \
DISCORD_BOT_TOKEN=your_token \
npm run cli -- monitor --channel discord
```

**Options**:
- `-c, --channel <channel>`: Channel type (default: from env or `redis`)

**Output**:
```
👁️  CoorChat Monitor

Listening for agent activity...

✅ Connected to redis channel

[10:30:45] TASK_ASSIGNED
  From: github-sync
  To: dev-agent-1
  Payload: {
    "taskId": "issue-123",
    "description": "Add user authentication"
  }

[10:30:50] TASK_STARTED
  From: dev-agent-1
  Payload: {
    "taskId": "issue-123",
    "status": "in_progress"
  }

[10:45:20] TASK_COMPLETED
  From: dev-agent-1
  Payload: {
    "taskId": "issue-123",
    "branch": "feature/user-auth"
  }
```

Press `Ctrl+C` to stop monitoring.

---

## Environment Variables

All CLI commands respect these environment variables:

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SHARED_TOKEN` | Authentication token (16+ chars) | `cct_a3f8d9e2...` |
| `CHANNEL_TYPE` | Channel type | `redis`, `discord`, `signalr` |

### Channel-Specific

**Redis**:
| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | _(none)_ |
| `REDIS_TLS` | Enable TLS | `false` |

**Discord**:
| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `DISCORD_CHANNEL_ID` | Discord channel ID |

**SignalR**:
| Variable | Description | Default |
|----------|-------------|---------|
| `SIGNALR_HUB_URL` | Hub URL | `https://localhost:5001/agentHub` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_ID` | Agent identifier | Auto-generated |
| `AGENT_ROLE` | Agent role | `developer` |
| `LOG_LEVEL` | Log verbosity | `info` |
| `GITHUB_TOKEN` | GitHub PAT | _(none)_ |
| `GITHUB_OWNER` | GitHub org/user | _(none)_ |
| `GITHUB_REPO` | GitHub repo | _(none)_ |

---

## Common Workflows

### 1. Quick Start (Local Testing)

```bash
# Generate token
npm run cli -- token generate

# Save output to .env
echo "SHARED_TOKEN=cct_..." > .env
echo "CHANNEL_TYPE=redis" >> .env

# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Start agent
npm run cli -- agent start --role developer
```

### 2. Multi-Agent Coordination

```bash
# Terminal 1: Developer
AGENT_ID=dev-1 npm run cli -- agent start --role developer

# Terminal 2: Tester
AGENT_ID=test-1 npm run cli -- agent start --role tester

# Terminal 3: Monitor
npm run cli -- monitor
```

### 3. GitHub Integration

```bash
# Generate tokens
GITHUB_TOKEN=ghp_your_token
WEBHOOK_SECRET=$(npm run cli -- token generate --type webhook | tail -1)

# Configure .env
cat >> .env << EOF
GITHUB_TOKEN=$GITHUB_TOKEN
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
GITHUB_WEBHOOK_SECRET=$WEBHOOK_SECRET
EOF

# Start agent with GitHub sync
npm run cli -- agent start --role developer
```

### 4. Production Deployment

```bash
# Use environment-specific config
export NODE_ENV=production
export CHANNEL_TYPE=signalr
export SIGNALR_HUB_URL=https://coorchat.example.com/hub
export SHARED_TOKEN=cct_production_token

# Start agent
npm run cli -- agent start \
  --id prod-agent-1 \
  --role developer
```

---

## Troubleshooting

### "Invalid or missing SHARED_TOKEN"

```bash
# Generate new token
npm run cli -- token generate

# Add to environment
export SHARED_TOKEN=cct_your_generated_token
```

### "Connection refused" (Redis)

```bash
# Check Redis is running
docker ps | grep redis

# Start Redis if not running
docker run -d --name coorchat-redis -p 6379:6379 redis:7-alpine
```

### "Cannot find module"

```bash
# Rebuild project
npm run build
```

### Agent not receiving messages

```bash
# Check token matches across all agents
npm run cli -- config show

# Verify channel connection
npm run cli -- monitor
```

---

## Programmatic Usage

Use the CLI programmatically in your Node.js scripts:

```typescript
import { TokenGenerator } from '@coorchat/mcp-server/config/TokenGenerator';
import { ChannelFactory } from '@coorchat/mcp-server/channels/base/ChannelFactory';

// Generate token
const token = TokenGenerator.generateChannelToken();

// Create channel
const channel = ChannelFactory.create({
  type: 'redis',
  token,
  connectionParams: {
    host: 'localhost',
    port: 6379,
  },
});

// Connect and listen
await channel.connect();
channel.onMessage((message) => {
  console.log('Received:', message);
});
```

---

## See Also

- [Installation Guide](../../INSTALL.md) - Full installation instructions
- [Scenarios](../../SCENARIOS.md) - Example coordination workflows
- [README](../../README.md) - Project overview
