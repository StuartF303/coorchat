# Implementation Plan: Agent Command Interface

**Branch**: `001-agent-command-interface` | **Date**: 2026-02-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-agent-command-interface/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a Slack-based command interface for managing the agent pool. Users can discover agents, check status, send direct messages, manage work queues, configure agents (model/role/queue limits), view logs and metrics, and control agent lifecycle through natural text commands. Configuration persists to local files, and task queues are configurable per agent (default 50 items).

**Technical Approach**: Extend the existing `src/index.ts` Slack message handler with a command parser that routes commands to appropriate handlers. Leverage existing AgentRegistry for agent discovery, MessageType protocol for task coordination, and SlackChannel for responses. Add new command handlers, configuration persistence layer, and formatting utilities for rich Slack responses.

## Technical Context

**Language/Version**: TypeScript 5.3+ with ES modules (Node.js 18+)
**Primary Dependencies**: @slack/socket-mode 2.0+, @slack/web-api 7.8+, winston 3.11+ (logging), zod 3.22+ (validation), dotenv 16.6+
**Storage**: Local JSON files per agent for configuration persistence (e.g., `.coorchat/config.json`)
**Testing**: Vitest 1.2+ with @vitest/coverage-v8 for unit and integration tests
**Target Platform**: Node.js server (Linux/Windows), runs alongside existing MCP server
**Project Type**: Single project (packages/mcp-server within monorepo)
**Performance Goals**: Command parsing <50ms, command execution <5 seconds, support 100+ concurrent agents without degradation
**Constraints**: Slack message limit 40,000 characters, 30-second timeout for agent responses, queue depth configurable (default 50)
**Scale/Scope**: 35+ commands across 7 categories, supports 100+ agents, integrates with existing channel adapters and protocol

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No constitution file exists yet. Proceeding without gates. Post-implementation, consider creating constitution to enforce:
- Minimal abstraction (no premature patterns)
- Existing code reuse (leverage AgentRegistry, ChannelAdapter, MessageType)
- Command handler simplicity (direct dispatch, no framework)

## Project Structure

### Documentation (this feature)

```text
specs/001-agent-command-interface/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── commands.schema.json  # Command schema definitions
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/mcp-server/
├── src/
│   ├── commands/                    # NEW: Command interface system
│   │   ├── CommandParser.ts         # Parse text into Command objects
│   │   ├── CommandRegistry.ts       # Register and dispatch commands
│   │   ├── handlers/                # Command category handlers
│   │   │   ├── DiscoveryCommands.ts     # list agents, status, ping all
│   │   │   ├── CommunicationCommands.ts # @agent, broadcast, ask
│   │   │   ├── QueueCommands.ts         # queue, tasks, assign, cancel, priority
│   │   │   ├── ConfigCommands.ts        # config model/role/queue-limit, pause, resume
│   │   │   ├── MonitoringCommands.ts    # logs, metrics, errors, history
│   │   │   └── SystemCommands.ts        # help, restart, shutdown, version
│   │   ├── formatters/              # Response formatting
│   │   │   ├── SlackFormatter.ts    # Markdown tables, code blocks, emoji
│   │   │   └── ResponseBuilder.ts   # Build structured responses
│   │   └── types.ts                 # Command, CommandType, CommandResponse types
│   │
│   ├── agents/                      # EXISTING: Extend for command support
│   │   ├── Agent.ts                 # ADD: config persistence, queue limit
│   │   ├── AgentRegistry.ts         # EXTEND: query methods for commands
│   │   └── AgentConfig.ts           # NEW: Configuration model with persistence
│   │
│   ├── tasks/                       # EXISTING: Extend for queue management
│   │   ├── TaskQueue.ts             # ADD: queue depth limits, priority reorder
│   │   ├── TaskManager.ts           # EXTEND: cross-agent task queries
│   │   └── TaskMetrics.ts           # NEW: Track completion stats for metrics
│   │
│   ├── channels/slack/              # EXISTING: Modify message handler
│   │   └── SlackChannel.ts          # MODIFY: Route text to CommandRegistry
│   │
│   ├── index.ts                     # EXISTING: Main entry point
│   │                                # MODIFY: Initialize CommandRegistry
│   │
│   └── protocol/                    # EXISTING: Message types
│       └── MessageTypes.ts          # EXTEND: Add command-related message types if needed
│
└── tests/
    ├── unit/
    │   └── commands/                # NEW: Unit tests for all handlers
    │       ├── CommandParser.test.ts
    │       ├── DiscoveryCommands.test.ts
    │       ├── CommunicationCommands.test.ts
    │       ├── QueueCommands.test.ts
    │       ├── ConfigCommands.test.ts
    │       ├── MonitoringCommands.test.ts
    │       └── SystemCommands.test.ts
    │
    └── integration/
        └── command-interface.test.ts # NEW: End-to-end command tests
```

**Structure Decision**: Single project structure (packages/mcp-server). New `src/commands/` directory contains all command interface logic. Extends existing `src/agents/` and `src/tasks/` for state management. Modifies `src/channels/slack/SlackChannel.ts` to route messages to CommandRegistry. Follows existing patterns (ChannelAdapter, AgentRegistry) to minimize abstraction.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Not applicable - no constitution violations.

## Phase 0: Research & Decisions

### Research Tasks

1. **Command Parsing Strategy**
   - **Research**: Evaluate regex vs. split-based parsing vs. commander.js integration for natural text commands
   - **Decision Criteria**: Simplicity, flexibility for fuzzy matching, maintainability

2. **Agent-to-Agent Communication Pattern**
   - **Research**: How direct messages (@agent-id) should be routed through relay server vs. direct channel
   - **Decision Criteria**: Existing MessageType protocol usage, response collection mechanism

3. **Configuration File Format**
   - **Research**: JSON vs. YAML vs. TOML for local config storage, location conventions (.coorchat/ vs. package root)
   - **Decision Criteria**: Atomic writes, human readability, Node.js ecosystem norms

4. **Queue Limit Enforcement**
   - **Research**: Where to enforce queue limits (agent-side vs. relay server), how to handle rejection gracefully
   - **Decision Criteria**: Consistency with existing task assignment, error visibility

5. **Response Formatting Best Practices**
   - **Research**: Slack Block Kit vs. markdown for rich formatting, table rendering, character limits
   - **Decision Criteria**: Readability, ease of implementation, mobile experience

6. **Agent Metrics Collection**
   - **Research**: Where to track task completion stats (agent-side vs. centralized), retention policy
   - **Decision Criteria**: Performance impact, accuracy, privacy

### Expected Artifacts

- **research.md**: Document all decisions with rationale, alternatives considered, and code examples where applicable

## Phase 1: Design & Contracts

### Data Model

**Entities**:
- **Command**: Parsed user instruction (type, target, params, userId, timestamp)
- **AgentConfig**: Persistent configuration (model, role, queueLimit, custom settings)
- **Task**: Work unit with ID, description, priority, status, metrics
- **CommandResponse**: Structured response (success/error, message, data, timestamp)

**Output**: `data-model.md` with field definitions, validation rules, state transitions

### API Contracts

**Command Schema**:
- Define command syntax patterns (regex or grammar)
- Parameter extraction rules
- Validation requirements

**Agent Query API**:
- Methods for `list agents`, `get agent status`, `get agent config`
- Return types with Slack formatting hints

**Task Management API**:
- Queue operations (add, remove, reorder, query)
- Cross-agent queries for `tasks` command

**Output**: `contracts/commands.schema.json` with command definitions and examples

### Quickstart Guide

**Output**: `quickstart.md` with:
- Developer setup (install deps, run tests)
- Adding a new command category
- Testing command handlers
- Debugging tips

### Agent Context Update

Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude` to add TypeScript, Vitest, Slack SDK patterns to agent memory.

## Phase 2: Implementation Tasks

*Not created by this command. Use `/speckit.tasks` to generate `tasks.md`.*

## Notes

- **Existing Code Reuse**: Leverage AgentRegistry, SlackChannel, MessageType protocol, existing logging (winston)
- **Incremental Testing**: Each command category can be implemented and tested independently per user story priorities
- **Configuration Migration**: No migration needed (new feature), but document .coorchat/config.json format for users
- **Performance Monitoring**: Add metrics for command parsing time, handler execution time, Slack API latency
- **Error Handling**: Consistent emoji indicators (✅ ❌ ℹ️) and user-friendly messages as per FR-037
