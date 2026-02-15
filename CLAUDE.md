# coorchat Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-14

## Active Technologies
- TypeScript 5.3+ with ES modules (Node.js 18+) + @slack/socket-mode 2.0+, @slack/web-api 7.8+, winston 3.11+ (logging), zod 3.22+ (validation), dotenv 16.6+ (001-agent-command-interface)
- Local JSON files per agent for configuration persistence (e.g., `.coorchat/config.json`) (001-agent-command-interface)



## Project Structure

```text
src/
tests/
```

## Commands

### Agent Command Interface (Slack)

The command interface provides natural language commands for managing the agent pool through Slack. All commands are case-insensitive.

**Agent Discovery:**
- `list agents` - List all connected agents with their ID, role, status, platform
- `status` - Show pool overview (total agents, by status, by role)
- `status T14` - Show detailed status for specific agent
- `ping all` - Ping all connected agents

**Direct Messaging:**
- `@T14 what are you working on?` - Send direct message to agent
- `broadcast All agents please report status` - Broadcast to all agents
- `ask T14 what is your current task?` - Ask question to agent (alternative syntax)

**Work Queue Management:**
- `queue T14` - Display task queue for specific agent
- `tasks` - Display all tasks grouped by agent
- `cancel task-123` - Cancel specific task by ID
- `assign T14 fix login bug` - Create and assign task to agent
- `priority task-123 high` - Update task priority (high/medium/low or 1-5)

**Agent Configuration:**
- `config T14 model opus` - Change agent model
- `config T14 role reviewer` - Change agent role
- `config T14 queue-limit 100` - Change queue capacity (1-1000)
- `config T14 show` - Display all agent settings
- `pause T14` - Pause agent (stops accepting tasks)
- `resume T14` - Resume agent (starts accepting tasks)

**Monitoring & Debugging:**
- `logs T14` - Retrieve last 50 log entries
- `logs T14 10` - Retrieve last 10 log entries
- `metrics T14` - Display task counts, success rate, uptime
- `errors` - Show recent errors across all agents
- `history T14` - Display completed tasks with durations

**System Management:**
- `help` - Display all available commands
- `version` - Show version information
- `restart T14` - Restart specific agent
- `shutdown T14` - Shutdown specific agent 

## Code Style

General: Follow standard conventions

## Recent Changes
- 001-agent-command-interface: Added TypeScript 5.3+ with ES modules (Node.js 18+) + @slack/socket-mode 2.0+, @slack/web-api 7.8+, winston 3.11+ (logging), zod 3.22+ (validation), dotenv 16.6+



<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
