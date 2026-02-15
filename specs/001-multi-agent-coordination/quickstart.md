# Quick Start Guide: Multi-Agent Coordination System

**Version**: 1.0
**Last Updated**: 2026-02-14

## Overview

This guide walks you through installing and configuring the CoorChat Multi-Agent Coordination System, connecting your first agent, and running a sample coordination workflow.

---

## Prerequisites

- **Node.js** v18+ (for MCP Server)
- **Docker** (recommended) OR npm
- **GitHub Personal Access Token** with `repo` scope
- **Channel Access**: One of the following:
  - Discord Bot Token (for Discord channel)
  - SignalR Hub URL (for SignalR channel)
  - Redis Instance (for Redis channel)
  - CoorChat Relay Server URL (for Relay channel)

---

## Installation

### Option 1: Docker (Recommended)

```bash
# Pull the latest MCP Server image
docker pull coorchat/mcp-server:latest

# Verify installation
docker run coorchat/mcp-server:latest --version
```

### Option 2: npm

```bash
# Install globally
npm install -g coorchat

# Verify installation
coorchat --version
```

---

## Configuration

### Step 1: Initialize Configuration

```bash
# Interactive configuration wizard
coorchat configure
```

The wizard will guide you through:

1. **Channel Type Selection**
   ```
   Select channel type:
   [1] Discord
   [2] SignalR
   [3] Redis
   [4] CoorChat Relay Server

   Choice: _
   ```

2. **Channel Connection Details** (example for Discord)
   ```
   Enter channel connection details:

   Discord Bot Token: ${DISCORD_BOT_TOKEN}
   Discord Guild ID: 123456789012345678
   Discord Channel ID: 987654321098765432
   ```

3. **GitHub Integration**
   ```
   Enter GitHub repository details:

   GitHub Personal Access Token: ${GITHUB_TOKEN}
   Repository URL: https://github.com/yourorg/yourrepo
   Webhook Secret (optional): ${GITHUB_WEBHOOK_SECRET}
   ```

4. **Retention & Logging**
   ```
   Configure retention and logging:

   Message retention (days): 30
   Log level (ERROR/WARN/INFO/DEBUG): INFO
   ```

### Step 2: Verify Configuration

Configuration is saved to `.coorchat/config.json`:

```json
{
  "version": "1.0",
  "channel": {
    "type": "discord",
    "config": {
      "guildId": "123456789012345678",
      "channelId": "987654321098765432",
      "botToken": "${DISCORD_BOT_TOKEN}"
    },
    "retentionDays": 30,
    "token": "${CHANNEL_TOKEN}"
  },
  "github": {
    "token": "${GITHUB_TOKEN}",
    "repositoryUrl": "https://github.com/yourorg/yourrepo",
    "webhookSecret": "${GITHUB_WEBHOOK_SECRET}",
    "pollingIntervalSeconds": 30
  },
  "logging": {
    "level": "INFO",
    "outputs": ["console"],
    "filePath": null
  }
}
```

### Step 3: Set Environment Variables

```bash
# Create .env file (NEVER commit this to git)
cat > .env <<EOF
DISCORD_BOT_TOKEN=your_discord_bot_token_here
CHANNEL_TOKEN=your_self_generated_channel_token_here
GITHUB_TOKEN=your_github_personal_access_token_here
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
EOF

# Or export directly
export DISCORD_BOT_TOKEN="your_discord_bot_token_here"
export CHANNEL_TOKEN="your_self_generated_channel_token_here"
export GITHUB_TOKEN="your_github_personal_access_token_here"
```

---

## Connecting Your First Agent

### Step 1: Join Channel

```bash
# Interactive join
coorchat join
```

The wizard prompts for:

```
Select agent role:
[1] Developer
[2] Tester
[3] Architect
[4] Frontend Developer
[5] Backend Developer
[6] Infrastructure Engineer
[7] Custom Role

Choice: 1

✅ Agent joined successfully

Agent ID: 550e8400-e29b-41d4-a716-446655440000
Role: developer
Platform: Linux
Environment: local

Connected to: discord channel
Status: Connected
```

### Step 2: Verify Connection

```bash
# Check status
coorchat status
```

Output:
```
┌─ CoorChat Status ──────────────────────────┐
│ Channel: discord/coorchat-main             │
│ Connected Agents: 1                        │
├────────────────────────────────────────────┤
│ ● developer-1  [Linux]    Idle             │
├────────────────────────────────────────────┤
│ Active Tasks: 0                            │
│ Messages Today: 3                          │
│ Uptime: 00:02:15                           │
└────────────────────────────────────────────┘
```

---

## Sample Workflow: Multi-Agent Task Coordination

### Scenario
Two agents (developer and tester) collaborate on implementing a feature from a GitHub issue.

### Step 1: Create GitHub Issue

Create an issue in your GitHub repository:
```
Title: Add user authentication
Body: Implement JWT-based authentication for the API
Label: feature
```

### Step 2: Connect Multiple Agents

**Terminal 1 (Developer Agent)**:
```bash
coorchat join --role developer
```

**Terminal 2 (Tester Agent)**:
```bash
coorchat join --role tester
```

### Step 3: Observe Task Assignment

The developer agent receives a `task_assigned` message (automatically via GitHub integration):

```json
{
  "protocolVersion": "1.0",
  "messageType": "task_assigned",
  "senderId": "system",
  "recipientId": "550e8400-e29b-41d4-a716-446655440000",
  "taskId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "priority": 5,
  "timestamp": "2026-02-14T10:30:00Z",
  "payload": {
    "taskId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "description": "Add user authentication",
    "dependencies": [],
    "githubIssue": "https://github.com/yourorg/yourrepo/issues/42"
  }
}
```

### Step 4: Developer Starts Work

Developer agent sends `task_started` message:

```json
{
  "protocolVersion": "1.0",
  "messageType": "task_started",
  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "taskId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "timestamp": "2026-02-14T10:31:00Z",
  "payload": {
    "taskId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "estimatedCompletionTime": "2026-02-14T12:00:00Z"
  }
}
```

All connected agents (including tester) see this update.

### Step 5: Developer Completes Work

Developer agent sends `task_completed` message:

```json
{
  "protocolVersion": "1.0",
  "messageType": "task_completed",
  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "taskId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "timestamp": "2026-02-14T11:45:00Z",
  "payload": {
    "taskId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "result": {
      "filesChanged": 5,
      "testsAdded": 12
    },
    "githubPR": "https://github.com/yourorg/yourrepo/pull/43"
  }
}
```

### Step 6: Tester Receives Notification

Tester agent automatically receives the `task_completed` message and can begin testing.

### Step 7: Check Status

```bash
coorchat status --verbose
```

Output shows both agents and their current tasks:
```
┌─ CoorChat Status ──────────────────────────┐
│ Channel: discord/coorchat-main             │
│ Connected Agents: 2                        │
├────────────────────────────────────────────┤
│ ● developer-1  [Linux]    Task#42 ✅      │
│ ● tester-1     [Windows]  Task#42 🔍      │
├────────────────────────────────────────────┤
│ Active Tasks: 1                            │
│ Messages Today: 15                         │
│ Uptime: 01:15:23                           │
└────────────────────────────────────────────┘
```

---

## Advanced Configuration

### Custom Agent Roles

Define a custom agent role:

```bash
coorchat join --role security-auditor
```

Register custom capabilities in `capabilities.json`:

```json
{
  "agentId": "YOUR_AGENT_UUID",
  "roleType": "security-auditor",
  "platform": "Linux",
  "environmentType": "local",
  "tools": ["sonarqube", "snyk", "owasp-zap"],
  "languages": ["Python", "JavaScript"],
  "apiAccess": ["Snyk API", "SonarCloud API"],
  "resourceLimits": {
    "apiQuotaPerHour": 1000,
    "maxConcurrentTasks": 1,
    "rateLimitPerMinute": 20,
    "memoryLimitMB": 1024
  },
  "customMetadata": {
    "scanTypes": ["SAST", "DAST", "SCA"],
    "complianceFrameworks": ["OWASP Top 10", "PCI DSS"]
  }
}
```

### Webhook Setup (Optional)

For real-time GitHub updates, configure a webhook:

1. Go to your GitHub repository → Settings → Webhooks
2. Add webhook:
   - Payload URL: `https://your-server.com/github/webhook`
   - Content type: `application/json`
   - Secret: (use `GITHUB_WEBHOOK_SECRET`)
   - Events: `Issues`, `Pull requests`
3. Save webhook

Without webhooks, the system falls back to polling (30-second intervals).

### Docker Compose Setup

For local development with multiple agents:

```yaml
# docker-compose.yml
version: '3.8'

services:
  agent-developer:
    image: coorchat/mcp-server:latest
    command: join --role developer
    environment:
      - DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
      - CHANNEL_TOKEN=${CHANNEL_TOKEN}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    volumes:
      - ./.coorchat:/app/.coorchat

  agent-tester:
    image: coorchat/mcp-server:latest
    command: join --role tester
    environment:
      - DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
      - CHANNEL_TOKEN=${CHANNEL_TOKEN}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    volumes:
      - ./.coorchat:/app/.coorchat
```

Run:
```bash
docker-compose up -d
```

---

## Troubleshooting

### Connection Failures

**Problem**: `ERR_CHANNEL_UNAVAILABLE`

**Solutions**:
1. Verify channel credentials (Discord token, Redis connection, etc.)
2. Check network connectivity
3. Review logs: `coorchat status --verbose` or check `.coorchat/logs/`

### Authentication Errors

**Problem**: `ERR_INVALID_TOKEN`

**Solutions**:
1. Verify environment variables are set correctly
2. Regenerate channel token: `coorchat configure --reset-token`
3. Check GitHub token has `repo` scope

### Message Delivery Issues

**Problem**: Messages not appearing in channel

**Solutions**:
1. Check agent status: `coorchat status`
2. Verify message protocol version compatibility
3. Review structured logs for errors

---

## Next Steps

1. **Read the Full Documentation**: [spec.md](./spec.md)
2. **Explore API Contracts**: [contracts/](./contracts/)
3. **Review Data Model**: [data-model.md](./data-model.md)
4. **Run Tests**: `npm test` (for contributors)
5. **Deploy to Production**: See deployment guide (TBD)

---

## Support

- **Issues**: https://github.com/coorchat/coorchat/issues
- **Documentation**: https://docs.coorchat.dev
- **Community**: https://discord.gg/coorchat

---

**Happy coordinating! 🤖🔗🤖**
