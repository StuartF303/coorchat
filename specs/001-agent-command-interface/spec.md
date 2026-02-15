# Feature Specification: Agent Command Interface

**Feature Branch**: `001-agent-command-interface`
**Created**: 2026-02-15
**Status**: Draft
**Input**: User description: "Plain Text Command Interface for Agent Pool Management"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent Discovery (Priority: P1)

As a pool manager, I need to see which agents are connected and their current status so I can understand the pool's capacity and health at a glance.

**Why this priority**: Without knowing what agents exist and their state, no other pool management is possible. This is the foundation for all other interactions.

**Independent Test**: Can be fully tested by connecting multiple agents with different roles and statuses, then issuing "list agents" and "status" commands. Delivers immediate value by showing pool visibility.

**Acceptance Scenarios**:

1. **Given** three agents are connected (T14 as developer, T15 as tester, T16 as devops), **When** user types "list agents", **Then** system displays a formatted list showing each agent's ID, role, current status (idle/busy), and model
2. **Given** agent T14 is connected and idle, **When** user types "status T14", **Then** system displays detailed status including connection time, current task (none), queue depth (0), and configuration
3. **Given** no agents are connected, **When** user types "list agents", **Then** system responds "No agents currently connected"
4. **Given** multiple agents are connected, **When** user types "status", **Then** system displays pool overview showing total agents, idle count, busy count, and pending tasks

---

### User Story 2 - Direct Messaging (Priority: P2)

As a pool manager, I need to chat directly with specific agents to give instructions, ask questions, or configure their behavior through natural conversation.

**Why this priority**: Direct communication enables flexible interaction without rigid command syntax. This is the primary way to leverage agent intelligence.

**Independent Test**: Can be fully tested by sending "@T14 what are you working on?" and receiving a natural language response. Delivers conversational agent interaction.

**Acceptance Scenarios**:

1. **Given** agent T14 is connected, **When** user types "@T14 what are you working on?", **Then** agent T14 receives the message and responds with its current task or "I'm idle"
2. **Given** agent T14 is connected, **When** user types "@T14 switch to opus model", **Then** agent T14 processes the configuration request and confirms "Switched to Claude Opus 4.6 model"
3. **Given** user types "@T99 hello" and agent T99 does not exist, **When** system processes the command, **Then** system responds "Agent T99 not found. Use 'list agents' to see connected agents"
4. **Given** multiple agents are mentioned in one message "@T14 @T15 status", **When** system processes the command, **Then** both agents respond with their status

---

### User Story 3 - Work Queue Inspection (Priority: P3)

As a pool manager, I need to view what tasks each agent has in their queue so I can understand workload distribution and identify bottlenecks.

**Why this priority**: Enables workload visibility and balancing. Essential for managing a pool efficiently, but agents can still work without queue visibility.

**Independent Test**: Can be fully tested by assigning tasks to an agent, then viewing its queue. Delivers task tracking capability.

**Acceptance Scenarios**:

1. **Given** agent T14 has two pending tasks in queue, **When** user types "queue T14", **Then** system displays both tasks with task ID, description, priority, and position in queue
2. **Given** agent T14 has an empty queue, **When** user types "queue T14", **Then** system responds "Agent T14 queue is empty"
3. **Given** multiple agents have tasks, **When** user types "tasks", **Then** system displays all tasks across all agents, grouped by agent ID
4. **Given** a task exists with ID task-123, **When** user types "cancel task-123", **Then** system removes the task from the queue and confirms "Task task-123 cancelled"

---

### User Story 4 - Task Assignment (Priority: P4)

As a pool manager, I need to assign specific tasks to agents so I can direct work to the appropriate specialist or balance load manually.

**Why this priority**: Enables explicit work distribution. Lower priority because agents can also pull work from shared queues, but manual assignment is valuable for urgent or specialized tasks.

**Independent Test**: Can be fully tested by issuing "assign T14 fix login bug" and verifying the task appears in T14's queue. Delivers directed task delegation.

**Acceptance Scenarios**:

1. **Given** agent T14 is idle, **When** user types "assign T14 investigate memory leak in SignalR hub", **Then** system creates a task, adds it to T14's queue, and notifies T14
2. **Given** agent T14 does not exist, **When** user types "assign T14 some task", **Then** system responds "Agent T14 not found. Use 'list agents' to see available agents"
3. **Given** a task is assigned with ID task-456, **When** user types "priority task-456 high", **Then** system updates the task priority and moves it to the front of the queue
4. **Given** user wants to broadcast a task, **When** user types "broadcast who can investigate the Redis connection timeout?", **Then** all connected agents receive the message and can respond

---

### User Story 5 - Agent Configuration (Priority: P5)

As a pool manager, I need to change agent settings like model and role so I can optimize performance and cost based on task requirements.

**Why this priority**: Enables dynamic optimization but isn't required for basic functionality. Most agents can run with default configuration.

**Independent Test**: Can be fully tested by changing an agent's model from sonnet to haiku and verifying the change via "config T14 show". Delivers runtime configuration capability.

**Acceptance Scenarios**:

1. **Given** agent T14 is running with sonnet model, **When** user types "config T14 model haiku", **Then** agent switches to Claude Haiku model and confirms the change
2. **Given** agent T14 has role "developer", **When** user types "config T14 role tester", **Then** agent updates its role to tester and adjusts its behavior accordingly
3. **Given** agent T14 exists, **When** user types "config T14 show", **Then** system displays current configuration including model, role, and any custom settings
4. **Given** agent T14 is busy, **When** user types "pause T14", **Then** agent finishes current task, stops accepting new work, and marks status as "paused"
5. **Given** agent T14 is paused, **When** user types "resume T14", **Then** agent resumes accepting work and marks status as "idle"

---

### User Story 6 - Monitoring and Debugging (Priority: P6)

As a pool manager, I need to view agent logs, metrics, and errors so I can diagnose issues and track performance over time.

**Why this priority**: Valuable for troubleshooting but not critical for basic operations. Agents can function without monitoring, but this becomes important at scale.

**Independent Test**: Can be fully tested by triggering an error in an agent, then viewing "errors" or "logs T14". Delivers observability.

**Acceptance Scenarios**:

1. **Given** agent T14 has processed 10 tasks today, **When** user types "metrics T14", **Then** system displays task count, success rate, average completion time, and uptime
2. **Given** agent T14 has recent log entries, **When** user types "logs T14 20", **Then** system displays the last 20 log entries with timestamps
3. **Given** agent T15 encountered an error 5 minutes ago, **When** user types "errors", **Then** system displays recent errors across all agents, including error message, agent ID, and timestamp
4. **Given** agent T14 has completed several tasks, **When** user types "history T14", **Then** system displays task history with completion status and timestamps

---

### User Story 7 - System Management (Priority: P7)

As a pool manager, I need system-level commands like help, version, and restart so I can manage the infrastructure and learn available capabilities.

**Why this priority**: Nice to have for operational convenience but lowest priority since these are administrative functions.

**Independent Test**: Can be fully tested by typing "help" and receiving command documentation. Delivers self-service learning.

**Acceptance Scenarios**:

1. **Given** user is unfamiliar with commands, **When** user types "help", **Then** system displays categorized list of all available commands with brief descriptions
2. **Given** user wants to test connectivity, **When** user types "ping all", **Then** all connected agents respond with "pong - {agent-id}"
3. **Given** agent T14 needs restart, **When** user types "restart T14", **Then** agent T14 gracefully disconnects, restarts, and reconnects
4. **Given** user wants version info, **When** user types "version", **Then** system displays version numbers for relay server and connected agents
5. **Given** user needs to shut down agent T14, **When** user types "shutdown T14", **Then** agent completes current task, saves state, and disconnects gracefully

---

### Edge Cases

- What happens when a command has ambiguous syntax (e.g., "status T14 T15" - multiple targets)?
  - System should interpret first token as agent ID, rest as garbage, or support multi-target commands explicitly
- What happens when an agent disconnects while user is waiting for response to "@T14 question"?
  - System should timeout after 30 seconds and notify "Agent T14 did not respond (may be disconnected)"
- What happens when task description contains special characters or is extremely long?
  - System should sanitize and truncate descriptions, warn if truncated
- What happens when multiple users issue conflicting commands simultaneously (e.g., both try to assign T14 different tasks)?
  - Commands should be queued and processed serially; last command wins for config changes
- What happens when user tries to configure an agent with invalid model name (e.g., "config T14 model gpt-4")?
  - System should validate model names against allowed list and return error with valid options
- What happens when agent's queue is full and user tries to assign another task?
  - System rejects with error indicating max queue depth reached. Each agent has configurable queue limit (default 50 items, adjustable via chat commands)
- What happens when user requests logs but agent has no logging capability?
  - System should return "Logging not available for agent T14" rather than error
- What happens to agent configuration when agent restarts?
  - Configuration persists to local file on agent machine, survives restarts. Agent loads saved config on startup

## Requirements *(mandatory)*

### Functional Requirements

**Command Processing**
- **FR-001**: System MUST parse text commands from Slack channel and extract command type, target agent ID, and parameters
- **FR-002**: System MUST support case-insensitive command matching (e.g., "LIST AGENTS", "list agents", "List Agents" all work)
- **FR-003**: System MUST validate agent IDs before routing commands and return clear error for non-existent agents
- **FR-004**: System MUST process commands serially in order received to prevent race conditions
- **FR-005**: System MUST respond to all commands within 5 seconds or provide acknowledgment that processing is underway

**Discovery Commands**
- **FR-006**: System MUST implement "list agents" command that displays all connected agents with ID, role, status, and model
- **FR-007**: System MUST implement "status" command that shows pool overview with total agents, idle count, busy count, pending tasks
- **FR-008**: System MUST implement "status <agent-id>" command that displays detailed agent information including connection time, current task, queue depth, configuration
- **FR-009**: System MUST implement "ping all" command that requests health check response from all connected agents

**Communication Commands**
- **FR-010**: System MUST implement "@<agent-id> <message>" syntax for direct messaging to specific agents
- **FR-011**: System MUST route direct messages to target agent and return agent's response to Slack channel
- **FR-012**: System MUST implement "broadcast <message>" command that sends message to all connected agents
- **FR-013**: System MUST implement timeout for agent responses (30 seconds) and notify user if agent does not respond
- **FR-014**: System MUST support "ask <agent-id> <question>" command as alternative to @ syntax

**Queue Management Commands**
- **FR-015**: System MUST implement "queue <agent-id>" command that displays all pending tasks in agent's queue with task ID, description, priority
- **FR-016**: System MUST implement "tasks" command that displays all tasks across all agents grouped by agent ID
- **FR-017**: System MUST implement "assign <agent-id> <task-description>" command that creates task and adds to agent's queue
- **FR-018**: System MUST implement "cancel <task-id>" command that removes task from queue and notifies relevant agent
- **FR-019**: System MUST implement "priority <task-id> <level>" command that changes task priority (high/medium/low or 1-5 numeric)

**Configuration Commands**
- **FR-020**: System MUST implement "config <agent-id> model <model-name>" command that changes agent's Claude model
- **FR-021**: System MUST validate model names against allowed list (sonnet, opus, haiku) and return error with valid options
- **FR-022**: System MUST implement "config <agent-id> role <role-name>" command that changes agent's role
- **FR-023**: System MUST implement "config <agent-id> show" command that displays all current configuration settings
- **FR-024**: System MUST implement "pause <agent-id>" command that prevents agent from accepting new tasks
- **FR-025**: System MUST implement "resume <agent-id>" command that allows paused agent to accept tasks again
- **FR-026**: System MUST implement "config <agent-id> queue-limit <number>" command that changes maximum queue depth for agent
- **FR-027**: System MUST persist configuration changes to local file on agent machine so they survive restarts
- **FR-028**: System MUST reject task assignments when agent's queue is at maximum capacity with error message indicating limit

**Monitoring Commands**
- **FR-029**: System MUST implement "logs <agent-id> [n]" command that retrieves last n log entries (default 50)
- **FR-030**: System MUST implement "metrics <agent-id>" command that displays task count, success rate, average completion time, uptime
- **FR-031**: System MUST implement "errors" command that displays recent errors across all agents with timestamps
- **FR-032**: System MUST implement "history <agent-id>" command that displays completed task history with status

**System Commands**
- **FR-033**: System MUST implement "help" command that displays categorized list of available commands with descriptions
- **FR-034**: System MUST implement "restart <agent-id>" command that gracefully restarts specific agent
- **FR-035**: System MUST implement "shutdown <agent-id>" command that gracefully stops specific agent
- **FR-036**: System MUST implement "version" command that displays system version information

**Response Formatting**
- **FR-037**: System MUST format multi-line responses using Slack markdown for readability (tables, code blocks, bullets)
- **FR-038**: System MUST truncate responses longer than Slack's 40,000 character limit and indicate truncation
- **FR-039**: System MUST include timestamp and requesting user in command acknowledgments
- **FR-040**: System MUST use consistent emoji indicators for different message types (✅ success, ❌ error, ℹ️ info)

**Security and Access Control**
- **FR-041**: System MUST authenticate that commands come from authorized Slack channel
- **FR-042**: System MUST log all commands with user ID, timestamp, and outcome
- **FR-043**: System MUST prevent command injection attacks by sanitizing input before processing

### Key Entities

- **Command**: Represents a parsed user instruction with type (discovery/communication/queue/config/monitoring/system), target agent ID (if applicable), parameters, and requesting user ID
- **Agent**: Represents a connected agent with unique ID, role (developer/tester/devops/pm), current status (idle/busy/paused), model (sonnet/opus/haiku), connection timestamp, queue limit (default 50, configurable), and other configuration settings
- **Task**: Represents a unit of work with unique ID, description, priority (1-5 or high/medium/low), assigned agent ID, creation timestamp, status (pending/in-progress/completed/cancelled)
- **AgentStatus**: Represents detailed agent state including current task (if any), queue depth, metrics (task count, success rate, uptime), and recent logs
- **CommandResponse**: Represents system's reply to command with success/failure status, message text, timestamp, and optional structured data (for list/status commands)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can discover all connected agents and their status in under 5 seconds using "list agents" command
- **SC-002**: Users can communicate with specific agents and receive responses within 10 seconds for 95% of direct messages
- **SC-003**: Command syntax is intuitive enough that 80% of commands are correctly formed on first attempt (measured by success rate vs. syntax errors)
- **SC-004**: All commands complete processing within 5 seconds or provide acknowledgment that longer processing is underway
- **SC-005**: System correctly parses and executes 99% of valid commands without errors
- **SC-006**: Help documentation is comprehensive enough that users can complete common tasks without external documentation (measured by reduction in support questions)
- **SC-007**: System handles 100+ concurrent agents without command processing degradation
- **SC-008**: Command history and logs enable root cause identification within 5 minutes for 90% of reported issues
- **SC-009**: Agent configuration changes take effect within 3 seconds and are confirmed to user
- **SC-010**: Task assignment and cancellation complete within 2 seconds and provide confirmation

## Assumptions

- **AS-001**: All commands are issued through the same Slack channel where agents are connected (single channel scope initially)
- **AS-002**: Agent configuration persists to local file on agent machine (e.g., .coorchat/config.json) and survives restarts
- **AS-003**: Task descriptions are free-form text and do not require structured format or GitHub issue integration initially
- **AS-004**: Task queues have configurable depth limit per agent (default 50 items), adjustable based on machine capabilities
- **AS-005**: All users in the Slack channel are authorized to issue commands (trust-based, no role-based access control initially)
- **AS-006**: Agents implement command handlers for configuration changes (model switching, role changes) - this requires agent-side implementation
- **AS-007**: The relay server (ConnectionManager) provides API to query connected agents and their metadata
- **AS-008**: Response formatting prioritizes readability over compactness (may use multiple messages for long responses)
- **AS-009**: Command history is retained in-memory for current session only (no long-term persistence)
- **AS-010**: Natural language parsing is limited to structured commands initially; full NLP (e.g., "what's T14 doing?") is future enhancement

## Dependencies

- **DEP-001**: Existing SlackChannel implementation for receiving text messages and sending responses
- **DEP-002**: Relay server ConnectionManager API for querying connected agents
- **DEP-003**: Agent-side command handlers for processing configuration requests (model, role, pause/resume, queue limits)
- **DEP-004**: Existing MessageType protocol for task assignment and coordination
- **DEP-005**: Agent-side logging capability for "logs" command to retrieve log entries
- **DEP-006**: Agent-side local file storage for persisting configuration (e.g., .coorchat/config.json on agent machine)

## Out of Scope

- **OOS-001**: Advanced natural language processing (accepting "show me all agents" vs. only "list agents")
- **OOS-002**: Role-based access control (admin vs. viewer permissions)
- **OOS-003**: Centralized database for configuration (local file storage is sufficient)
- **OOS-004**: GitHub issue integration for task management
- **OOS-005**: Web-based UI or alternative interfaces (Slack only)
- **OOS-006**: Multi-channel coordination (agents in different Slack channels)
- **OOS-007**: Scheduled commands or automation (cron-like functionality)
- **OOS-008**: Agent-to-agent communication initiated by commands
- **OOS-009**: Command macros or aliases (user-defined shortcuts)
- **OOS-010**: Audit trail export or compliance reporting features
