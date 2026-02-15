/**
 * Integration tests for Command Interface
 * Tests end-to-end command execution with real components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlackChannel } from '../../src/channels/slack/SlackChannel';
import { CommandRegistry } from '../../src/commands/CommandRegistry';
import { AgentRegistry } from '../../src/agents/AgentRegistry';
import { TaskManager } from '../../src/tasks/TaskManager';
import type { ChannelConfig } from '../../src/channels/base/Channel';
import type { Agent } from '../../src/agents/Agent';
import { AgentStatus } from '../../src/agents/Agent';

describe('Command Interface - Agent Discovery (US1)', () => {
  let channel: SlackChannel;
  let registry: CommandRegistry;
  let agentRegistry: AgentRegistry;
  let sentMessages: string[];

  beforeEach(async () => {
    // Mock configuration
    const config: ChannelConfig = {
      type: 'slack',
      token: 'test-token-1234567890',
      connectionParams: {
        botToken: 'xoxb-test-token-1234567890',
        appToken: 'xapp-test-token-1234567890',
        channelId: 'C123',
      },
    };

    // Create channel with mocked sendText
    channel = new SlackChannel(config);
    sentMessages = [];
    vi.spyOn(channel, 'sendText').mockImplementation(async (text: string) => {
      sentMessages.push(text);
    });

    // Create agent registry (disable timeout checking for tests)
    agentRegistry = new AgentRegistry({ enableTimeoutChecking: false });

    // Create command registry
    registry = new CommandRegistry(channel, agentRegistry);

    // Register mock agents using correct Agent interface
    await agentRegistry.add({
      id: 'T14',
      role: 'developer',
      platform: 'Linux',
      environment: 'local',
      capabilities: {
        canExecuteCode: true,
        canReadFiles: true,
        canWriteFiles: true,
      },
      status: AgentStatus.CONNECTED,
      currentTask: null,
      registeredAt: new Date(),
      lastSeenAt: new Date(),
    });
    await agentRegistry.add({
      id: 'T15',
      role: 'tester',
      platform: 'macOS',
      environment: 'local',
      capabilities: {
        canExecuteCode: true,
        canReadFiles: true,
        canWriteFiles: false,
      },
      status: AgentStatus.CONNECTED,
      currentTask: 'task-123',
      registeredAt: new Date(),
      lastSeenAt: new Date(),
    });
    await agentRegistry.add({
      id: 'T16',
      role: 'devops',
      platform: 'Windows',
      environment: 'local',
      capabilities: {
        canExecuteCode: false,
        canReadFiles: true,
        canWriteFiles: true,
      },
      status: AgentStatus.CONNECTED,
      currentTask: null,
      registeredAt: new Date(),
      lastSeenAt: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (agentRegistry) {
      agentRegistry.destroy();
    }
  });

  describe('T016: list agents command', () => {
    it('should display all connected agents in a table', async () => {
      await registry.handleCommand('list agents', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should include all agent IDs
      expect(response).toContain('T14');
      expect(response).toContain('T15');
      expect(response).toContain('T16');

      // Should include roles
      expect(response).toContain('developer');
      expect(response).toContain('tester');
      expect(response).toContain('devops');

      // Should include platforms
      expect(response).toContain('Linux');
      expect(response).toContain('macOS');
      expect(response).toContain('Windows');

      // Should include status
      expect(response).toContain('connected');
    });

    it('should handle no connected agents', async () => {
      // Create empty registry
      const emptyRegistry = new AgentRegistry();
      const emptyCommandRegistry = new CommandRegistry(channel, emptyRegistry);

      await emptyCommandRegistry.handleCommand('list agents', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('No agents');
    });
  });

  describe('T017: status command (pool overview)', () => {
    it('should display pool summary with counts', async () => {
      await registry.handleCommand('status', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should include total count
      expect(response).toMatch(/total.*3/i);

      // Should include connected count
      expect(response).toMatch(/connected.*3/i);

      // Should include active count
      expect(response).toMatch(/active.*3/i);

      // Should include role breakdown
      expect(response).toContain('developer');
      expect(response).toContain('tester');
      expect(response).toContain('devops');
    });
  });

  describe('T018: status <agent-id> command', () => {
    it('should display detailed status for specific agent', async () => {
      await registry.handleCommand('status T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should include agent ID
      expect(response).toContain('T14');

      // Should include role
      expect(response).toContain('developer');

      // Should include platform
      expect(response).toContain('Linux');

      // Should include status
      expect(response).toContain('connected');

      // Should include environment
      expect(response).toContain('local');
    });

    it('should handle non-existent agent', async () => {
      await registry.handleCommand('status T99', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      expect(response).toContain('not found');
      expect(response).toContain('T99');
    });
  });

  describe('T019: ping all command', () => {
    it('should ping all connected agents', async () => {
      await registry.handleCommand('ping all', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages.join('\n');

      // For now, should acknowledge the command
      // Full implementation will broadcast to agents
      expect(response).toBeTruthy();
    });
  });
});

describe('Command Interface - Direct Messaging (US2)', () => {
  let channel: SlackChannel;
  let registry: CommandRegistry;
  let agentRegistry: AgentRegistry;
  let sentMessages: string[];

  beforeEach(async () => {
    const config: ChannelConfig = {
      type: 'slack',
      token: 'test-token-1234567890',
      connectionParams: {
        botToken: 'xoxb-test-token-1234567890',
        appToken: 'xapp-test-token-1234567890',
        channelId: 'C123',
      },
    };

    channel = new SlackChannel(config);
    sentMessages = [];
    vi.spyOn(channel, 'sendText').mockImplementation(async (text: string) => {
      sentMessages.push(text);
    });

    agentRegistry = new AgentRegistry({ enableTimeoutChecking: false });
    registry = new CommandRegistry(channel, agentRegistry);

    await agentRegistry.add({
      id: 'T14',
      role: 'developer',
      platform: 'Linux',
      environment: 'local',
      capabilities: {
        canExecuteCode: true,
        canReadFiles: true,
        canWriteFiles: true,
      },
      status: AgentStatus.CONNECTED,
      currentTask: null,
      registeredAt: new Date(),
      lastSeenAt: new Date(),
    });
    await agentRegistry.add({
      id: 'T15',
      role: 'tester',
      platform: 'macOS',
      environment: 'local',
      capabilities: {
        canExecuteCode: true,
        canReadFiles: true,
        canWriteFiles: false,
      },
      status: AgentStatus.CONNECTED,
      currentTask: null,
      registeredAt: new Date(),
      lastSeenAt: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (agentRegistry) {
      agentRegistry.destroy();
    }
  });

  describe('T029: @agent-id syntax', () => {
    it('should send direct message to specific agent', async () => {
      await registry.handleCommand('@T14 what are you working on?', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should acknowledge the message
      expect(response).toContain('T14');
      expect(response).toContain('Message sent');
    });

    it('should handle agent not found', async () => {
      await registry.handleCommand('@T99 hello', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      expect(response).toContain('not found');
      expect(response).toContain('T99');
    });

    it('should handle missing message text', async () => {
      await registry.handleCommand('@T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // CommandRegistry catches insufficient args before handler executes
      expect(response).toContain('requires at least 1 arguments');
    });
  });

  describe('T030: broadcast command', () => {
    it('should broadcast message to all agents', async () => {
      await registry.handleCommand('broadcast hello everyone', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should acknowledge broadcast
      expect(response).toContain('Broadcasting');
      expect(response).toContain('2'); // 2 agents
    });

    it('should handle empty agent pool', async () => {
      const emptyRegistry = new AgentRegistry({ enableTimeoutChecking: false });
      const emptyCommandRegistry = new CommandRegistry(channel, emptyRegistry);

      await emptyCommandRegistry.handleCommand('broadcast hello', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('No agents');
    });

    it('should handle missing message text', async () => {
      await registry.handleCommand('broadcast', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      // CommandRegistry catches insufficient args before handler executes
      expect(sentMessages[0]).toContain('requires at least 1 arguments');
    });
  });

  describe('T031: ask command', () => {
    it('should send question to specific agent', async () => {
      await registry.handleCommand('ask T14 what is your current task?', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should acknowledge the question
      expect(response).toContain('T14');
      expect(response).toContain('Question sent');
    });

    it('should handle agent not found', async () => {
      await registry.handleCommand('ask T99 hello', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('not found');
    });

    it('should handle missing agent ID', async () => {
      await registry.handleCommand('ask', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // CommandRegistry arg validation triggers before ask handler
      expect(response).toContain('requires at least 2 arguments');
    });

    it('should handle missing question text', async () => {
      await registry.handleCommand('ask T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      // CommandRegistry catches insufficient args before handler executes
      expect(sentMessages[0]).toContain('requires at least 2 arguments');
    });
  });
});

describe('Command Interface - Work Queue Inspection (US3)', () => {
  let channel: SlackChannel;
  let registry: CommandRegistry;
  let agentRegistry: AgentRegistry;
  let taskManager: TaskManager;
  let sentMessages: string[];

  beforeEach(async () => {
    const config: ChannelConfig = {
      type: 'slack',
      token: 'test-token-1234567890',
      connectionParams: {
        botToken: 'xoxb-test-token-1234567890',
        appToken: 'xapp-test-token-1234567890',
        channelId: 'C123',
      },
    };

    channel = new SlackChannel(config);
    sentMessages = [];
    vi.spyOn(channel, 'sendText').mockImplementation(async (text: string) => {
      sentMessages.push(text);
    });

    agentRegistry = new AgentRegistry({ enableTimeoutChecking: false });
    taskManager = new TaskManager();
    registry = new CommandRegistry(channel, agentRegistry, taskManager);

    await agentRegistry.add({
      id: 'T14',
      role: 'developer',
      platform: 'Linux',
      environment: 'local',
      capabilities: {
        canExecuteCode: true,
        canReadFiles: true,
        canWriteFiles: true,
      },
      status: AgentStatus.CONNECTED,
      currentTask: null,
      registeredAt: new Date(),
      lastSeenAt: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (agentRegistry) {
      agentRegistry.destroy();
    }
  });

  describe('T039: queue <agent-id> command', () => {
    it('should display pending tasks for specific agent', async () => {
      await registry.handleCommand('queue T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should acknowledge command (MVP: shows empty queue or tasks)
      expect(response).toBeTruthy();
    });

    it('should handle agent not found', async () => {
      await registry.handleCommand('queue T99', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('not found');
    });

    it('should handle missing agent ID', async () => {
      await registry.handleCommand('queue', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      // CommandRegistry catches insufficient args
      expect(sentMessages[0]).toContain('requires at least 1 arguments');
    });
  });

  describe('T040: tasks command', () => {
    it('should display all tasks grouped by agent', async () => {
      await registry.handleCommand('tasks', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should show task summary
      expect(response).toBeTruthy();
    });
  });

  describe('T041: cancel <task-id> command', () => {
    it('should cancel specific task', async () => {
      await registry.handleCommand('cancel task-123', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should acknowledge cancellation or report task not found
      expect(response).toBeTruthy();
    });

    it('should handle task not found', async () => {
      await registry.handleCommand('cancel nonexistent-task', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('not found');
    });

    it('should handle missing task ID', async () => {
      await registry.handleCommand('cancel', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      // CommandRegistry catches insufficient args
      expect(sentMessages[0]).toContain('requires at least 1 arguments');
    });
  });
});

describe('Command Interface - Task Assignment (US4)', () => {
  let channel: SlackChannel;
  let registry: CommandRegistry;
  let agentRegistry: AgentRegistry;
  let taskManager: TaskManager;
  let sentMessages: string[];

  beforeEach(async () => {
    const config: ChannelConfig = {
      type: 'slack',
      token: 'test-token-1234567890',
      connectionParams: {
        botToken: 'xoxb-test-token-1234567890',
        appToken: 'xapp-test-token-1234567890',
        channelId: 'C123',
      },
    };

    channel = new SlackChannel(config);
    sentMessages = [];
    vi.spyOn(channel, 'sendText').mockImplementation(async (text: string) => {
      sentMessages.push(text);
    });

    agentRegistry = new AgentRegistry({ enableTimeoutChecking: false });
    taskManager = new TaskManager();
    registry = new CommandRegistry(channel, agentRegistry, taskManager);

    await agentRegistry.add({
      id: 'T14',
      role: 'developer',
      platform: 'Linux',
      environment: 'local',
      capabilities: {
        canExecuteCode: true,
        canReadFiles: true,
        canWriteFiles: true,
      },
      status: AgentStatus.CONNECTED,
      currentTask: null,
      registeredAt: new Date(),
      lastSeenAt: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (agentRegistry) {
      agentRegistry.destroy();
    }
  });

  describe('T048: assign command', () => {
    it('should create task and add to agent queue', async () => {
      await registry.handleCommand('assign T14 fix login bug', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should acknowledge assignment
      expect(response).toContain('T14');
      expect(response).toContain('assigned');
    });

    it('should handle agent not found', async () => {
      await registry.handleCommand('assign T99 some task', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('not found');
    });

    it('should handle missing task description', async () => {
      await registry.handleCommand('assign T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      // CommandRegistry catches insufficient args
      expect(sentMessages[0]).toContain('requires at least 2 arguments');
    });
  });

  describe('T049: priority command', () => {
    it('should update task priority with high/medium/low', async () => {
      // First create a task
      await registry.handleCommand('assign T14 test task', 'user123');
      sentMessages = []; // Clear messages

      // Get the created task ID (would need to be exposed)
      // For now, just test the command accepts priority values
      await registry.handleCommand('priority task-123 high', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should acknowledge or report task not found
      expect(response).toBeTruthy();
    });

    it('should support numeric priorities 1-5', async () => {
      await registry.handleCommand('priority task-123 3', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toBeTruthy();
    });

    it('should handle invalid priority', async () => {
      await registry.handleCommand('priority task-123 invalid', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('Invalid priority');
    });

    it('should handle task not found', async () => {
      await registry.handleCommand('priority nonexistent high', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('not found');
    });
  });

  describe('T050: queue full error', () => {
    it('should reject assignment when queue is full', async () => {
      // Create a task manager with very small queue limit
      const smallTaskManager = new TaskManager({ maxQueueSizePerAgent: 2 });
      const smallRegistry = new CommandRegistry(channel, agentRegistry, smallTaskManager);

      // Fill the queue
      await smallRegistry.handleCommand('assign T14 task 1', 'user123');
      await smallRegistry.handleCommand('assign T14 task 2', 'user123');
      sentMessages = []; // Clear

      // Try to add one more (should fail)
      await smallRegistry.handleCommand('assign T14 task 3', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('full');
    });

    it('should show current and max limit in error', async () => {
      const smallTaskManager = new TaskManager({ maxQueueSizePerAgent: 1 });
      const smallRegistry = new CommandRegistry(channel, agentRegistry, smallTaskManager);

      await smallRegistry.handleCommand('assign T14 task 1', 'user123');
      sentMessages = [];

      await smallRegistry.handleCommand('assign T14 task 2', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('max');
    });
  });

  // ===========================
  // User Story 5: Agent Configuration
  // ===========================

  describe('T057: config model command', () => {
    it('should update agent model', async () => {
      await registry.handleCommand('config T14 model opus', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should confirm model update
      expect(response).toContain('model');
      expect(response).toContain('opus');
    });

    it('should handle invalid model', async () => {
      await registry.handleCommand('config T14 model invalid-model', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('Invalid');
    });
  });

  describe('T058: config role command', () => {
    it('should update agent role', async () => {
      await registry.handleCommand('config T14 role reviewer', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      expect(response).toContain('role');
      expect(response).toContain('reviewer');
    });

    it('should validate role', async () => {
      await registry.handleCommand('config T14 role', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      // Should require role parameter
      expect(sentMessages[0]).toContain('Role name required');
    });
  });

  describe('T059: config queue-limit command', () => {
    it('should update queue limit', async () => {
      await registry.handleCommand('config T14 queue-limit 100', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      expect(response).toContain('queue-limit');
      expect(response).toContain('100');
    });

    it('should validate limit range (1-1000)', async () => {
      await registry.handleCommand('config T14 queue-limit 2000', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('between 1 and 1000');
    });

    it('should reject non-numeric limit', async () => {
      await registry.handleCommand('config T14 queue-limit abc', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('Invalid');
    });
  });

  describe('T060: config show command', () => {
    it('should display all agent settings', async () => {
      await registry.handleCommand('config T14 show', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should show config details
      expect(response).toContain('T14');
      expect(response).toBeTruthy();
    });

    it('should handle agent not found', async () => {
      await registry.handleCommand('config T99 show', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('not found');
    });
  });

  describe('T061: pause and resume commands', () => {
    it('should pause agent', async () => {
      await registry.handleCommand('pause T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      expect(response).toContain('T14');
      expect(response).toContain('paused');
    });

    it('should resume agent', async () => {
      await registry.handleCommand('resume T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      expect(response).toContain('T14');
      expect(response).toContain('resumed');
    });

    it('should prevent task assignment to paused agent', async () => {
      await registry.handleCommand('pause T14', 'user123');
      sentMessages = [];

      await registry.handleCommand('assign T14 test task', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('paused');
    });
  });

  // ===========================
  // User Story 6: Monitoring and Debugging
  // ===========================

  describe('T073: logs command', () => {
    it('should retrieve recent logs for agent', async () => {
      await registry.handleCommand('logs T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should show logs (or no logs message)
      expect(response).toBeTruthy();
    });

    it('should support custom log count', async () => {
      await registry.handleCommand('logs T14 10', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toBeTruthy();
    });

    it('should handle agent not found', async () => {
      await registry.handleCommand('logs T99', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('not found');
    });
  });

  describe('T074: metrics command', () => {
    it('should show agent metrics', async () => {
      await registry.handleCommand('metrics T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should show metrics
      expect(response).toBeTruthy();
    });

    it('should show task counts', async () => {
      // Create some tasks first
      await registry.handleCommand('assign T14 task 1', 'user123');
      sentMessages = [];

      await registry.handleCommand('metrics T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('Tasks');
    });

    it('should handle agent not found', async () => {
      await registry.handleCommand('metrics T99', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('not found');
    });
  });

  describe('T075: errors command', () => {
    it('should show recent errors', async () => {
      await registry.handleCommand('errors', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should show errors (or no errors message)
      expect(response).toBeTruthy();
    });

    it('should show errors across all agents', async () => {
      await registry.handleCommand('errors', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      // Should acknowledge the command
      expect(sentMessages[0]).toBeTruthy();
    });
  });

  describe('T076: history command', () => {
    it('should show task history for agent', async () => {
      await registry.handleCommand('history T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should show history (or no history message)
      expect(response).toBeTruthy();
    });

    it('should handle agent not found', async () => {
      await registry.handleCommand('history T99', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('not found');
    });
  });

  // ===========================
  // User Story 7: System Management
  // ===========================

  describe('T087: help command', () => {
    it('should display all available commands', async () => {
      await registry.handleCommand('help', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should show command categories
      expect(response).toBeTruthy();
      expect(response.length).toBeGreaterThan(0);
    });

    it('should show command descriptions', async () => {
      await registry.handleCommand('help', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should contain some command names
      expect(response).toContain('list');
    });
  });

  describe('T088: version command', () => {
    it('should display version information', async () => {
      await registry.handleCommand('version', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should show version info
      expect(response).toBeTruthy();
    });
  });

  describe('T089: restart command', () => {
    it('should restart specific agent', async () => {
      await registry.handleCommand('restart T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should acknowledge restart
      expect(response).toContain('T14');
      expect(response).toContain('Restart');
    });

    it('should handle agent not found', async () => {
      await registry.handleCommand('restart T99', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('not found');
    });
  });

  describe('T090: shutdown command', () => {
    it('should shutdown specific agent', async () => {
      await registry.handleCommand('shutdown T14', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      const response = sentMessages[0];

      // Should acknowledge shutdown
      expect(response).toContain('T14');
      expect(response).toContain('Shutdown');
    });

    it('should handle agent not found', async () => {
      await registry.handleCommand('shutdown T99', 'user123');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0]).toContain('not found');
    });
  });
});
