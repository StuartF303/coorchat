# CoorChat Local Installation Guide

## Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose (optional, for Redis/Relay Server)
- **Git** (for cloning)
- **Claude Desktop** (for MCP integration)

## Quick Start (5 minutes)

### Step 1: Install Dependencies

```bash
# Navigate to MCP server package
cd packages/mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

### Step 2: Generate Secure Token

```bash
# Generate a secure shared token (on Windows/Git Bash)
node -e "console.log('cct_' + require('crypto').randomBytes(32).toString('hex'))"

# Save the output - you'll need it for all agents
# Example output: cct_a3f8d9e2c1b4f7a6e8d2c9b1f4a7e3d2c6b9f1e4a8d3c7b2f5e9a1d4c8b3f6
```

### Step 3: Choose Your Channel

You have **3 options** - pick the easiest for you:

#### **Option A: Redis (Recommended - Most Reliable)**

```bash
# Start Redis using Docker
docker run -d --name coorchat-redis -p 6379:6379 redis:7-alpine

# Or install Redis locally on Windows:
# Download from: https://github.com/microsoftarchive/redis/releases
```

#### **Option B: Discord (Easiest - No Setup)**

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to "Bot" → "Add Bot"
4. Copy the bot token
5. Enable "Message Content Intent"
6. Invite bot to your server using OAuth2 URL generator
7. Create a channel and copy its ID (right-click → Copy ID)

#### **Option C: SignalR Relay Server (Advanced)**

```bash
# From repo root
cd packages/relay-server

# Build and run with Docker
docker build -t coorchat-relay .
docker run -d -p 5001:5001 -e Authentication__SharedToken=YOUR_TOKEN coorchat-relay
```

### Step 4: Configure MCP Server for Claude

Create a config file at: `C:\Users\YourUser\.claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "coorchat": {
      "command": "node",
      "args": [
        "C:\\projects\\coorchat\\packages\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "CHANNEL_TYPE": "redis",
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6379",
        "SHARED_TOKEN": "cct_YOUR_TOKEN_FROM_STEP2",
        "AGENT_ID": "agent-claude-1",
        "AGENT_ROLE": "developer",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**For Discord instead:**
```json
{
  "mcpServers": {
    "coorchat": {
      "command": "node",
      "args": [
        "C:\\projects\\coorchat\\packages\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "CHANNEL_TYPE": "discord",
        "DISCORD_BOT_TOKEN": "YOUR_BOT_TOKEN",
        "DISCORD_CHANNEL_ID": "YOUR_CHANNEL_ID",
        "SHARED_TOKEN": "cct_YOUR_TOKEN_FROM_STEP2",
        "AGENT_ID": "agent-claude-1",
        "AGENT_ROLE": "developer",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Step 5: Configure GitHub Integration (Optional)

```json
{
  "mcpServers": {
    "coorchat": {
      "command": "node",
      "args": [
        "C:\\projects\\coorchat\\packages\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "CHANNEL_TYPE": "redis",
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6379",
        "SHARED_TOKEN": "cct_YOUR_TOKEN",
        "AGENT_ID": "agent-claude-1",
        "AGENT_ROLE": "developer",
        "GITHUB_TOKEN": "ghp_YOUR_GITHUB_PAT",
        "GITHUB_OWNER": "your-org",
        "GITHUB_REPO": "your-repo",
        "GITHUB_WEBHOOK_SECRET": "your_webhook_secret",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Get GitHub Token:**
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `repo`, `read:org`
4. Copy the token

### Step 6: Restart Claude Desktop

Close and reopen Claude Desktop to load the MCP server.

## Verify Installation

### Test 1: Check MCP Server is Running

In Claude Desktop, type:
```
Can you check if the coorchat MCP server is connected?
```

You should see the MCP tools available in Claude's context.

### Test 2: Run Integration Tests

```bash
cd packages/mcp-server
npm test
```

Expected output:
```
Test Files  2 passed (2)
Tests  34 passed (34)
```

### Test 3: Manual Channel Test

Create a test script `test-connection.js`:

```javascript
import { ChannelFactory } from './dist/channels/base/ChannelFactory.js';

const config = {
  type: 'redis',
  token: 'cct_YOUR_TOKEN',
  connectionParams: {
    host: 'localhost',
    port: 6379,
  },
};

const channel = ChannelFactory.create(config);
await channel.connect();
console.log('✅ Connected to channel!');

channel.onMessage((message) => {
  console.log('📨 Received:', message);
});

await channel.disconnect();
```

Run it:
```bash
node test-connection.js
```

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CHANNEL_TYPE` | Yes | Channel type | `redis`, `discord`, `signalr` |
| `SHARED_TOKEN` | Yes | Auth token (16+ chars) | `cct_a3f8d9...` |
| `AGENT_ID` | Yes | Unique agent identifier | `agent-claude-1` |
| `AGENT_ROLE` | Yes | Agent role | `developer`, `tester`, `architect` |
| `REDIS_HOST` | If redis | Redis hostname | `localhost` |
| `REDIS_PORT` | If redis | Redis port | `6379` |
| `REDIS_PASSWORD` | If redis | Redis password | `your_password` |
| `REDIS_TLS` | If redis | Enable TLS | `true`, `false` |
| `DISCORD_BOT_TOKEN` | If discord | Discord bot token | `MTk4...` |
| `DISCORD_CHANNEL_ID` | If discord | Discord channel ID | `123456789...` |
| `SIGNALR_HUB_URL` | If signalr | SignalR hub URL | `https://localhost:5001/agentHub` |
| `GITHUB_TOKEN` | Optional | GitHub PAT | `ghp_...` |
| `GITHUB_OWNER` | Optional | GitHub org/user | `your-org` |
| `GITHUB_REPO` | Optional | GitHub repo | `your-repo` |
| `GITHUB_WEBHOOK_SECRET` | Optional | Webhook secret | `your_secret` |
| `LOG_LEVEL` | Optional | Log verbosity | `debug`, `info`, `warn`, `error` |

## Multi-Agent Setup (Testing Coordination)

To test multiple agents coordinating:

### Terminal 1: Developer Agent
```bash
cd packages/mcp-server
CHANNEL_TYPE=redis \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
SHARED_TOKEN=cct_YOUR_TOKEN \
AGENT_ID=agent-dev-1 \
AGENT_ROLE=developer \
node dist/index.js
```

### Terminal 2: Tester Agent
```bash
cd packages/mcp-server
CHANNEL_TYPE=redis \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
SHARED_TOKEN=cct_YOUR_TOKEN \
AGENT_ID=agent-test-1 \
AGENT_ROLE=tester \
node dist/index.js
```

### Terminal 3: Monitor Redis Messages
```bash
docker exec -it coorchat-redis redis-cli
> SUBSCRIBE coorchat:channel
```

## Troubleshooting

### "Cannot find module" errors
```bash
cd packages/mcp-server
npm run build
```

### "ECONNREFUSED" on Redis
```bash
# Check Redis is running
docker ps | grep redis

# Or start it
docker run -d --name coorchat-redis -p 6379:6379 redis:7-alpine
```

### MCP server not showing in Claude
1. Check Claude Desktop logs: `%APPDATA%\Claude\logs\`
2. Verify paths in `claude_desktop_config.json` use absolute paths
3. Ensure backslashes are escaped: `C:\\projects\\...`
4. Restart Claude Desktop completely

### "Invalid authentication token" errors
- Ensure `SHARED_TOKEN` is the same across all agents
- Token must be 16+ characters
- Use the `cct_` prefix for channel tokens

### GitHub integration not working
- Verify `GITHUB_TOKEN` has `repo` scope
- Check `GITHUB_OWNER` and `GITHUB_REPO` are correct
- Ensure repo exists and token has access

## Docker Compose Quick Start

From repo root:

```bash
# Start everything (Redis + Relay Server)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

Then configure Claude Desktop to use Redis at `localhost:6379`.

## Next Steps

Once installed:

1. **Test basic coordination**: Create a task and assign it to an agent
2. **Set up GitHub sync**: Connect to a repo and sync issues
3. **Add more agents**: Create multiple Claude Desktop profiles or standalone agents
4. **Monitor coordination**: Watch agents communicate and coordinate work

## Development Mode

For active development:

```bash
cd packages/mcp-server

# Watch mode (auto-rebuild on changes)
npm run dev

# Run tests on save
npm test -- --watch
```

## Uninstall

```bash
# Remove Docker containers
docker-compose down -v
docker rm -f coorchat-redis

# Remove MCP server from Claude config
# Edit: C:\Users\YourUser\.claude\claude_desktop_config.json
# Remove the "coorchat" entry

# Remove node_modules
cd packages/mcp-server
rm -rf node_modules dist
```
