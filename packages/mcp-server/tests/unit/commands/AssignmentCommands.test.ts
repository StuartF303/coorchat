/**
 * Unit tests for AssignmentCommands
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  assignTask,
  updatePriority,
} from '../../../src/commands/handlers/AssignmentCommands';
import { AgentRegistry } from '../../../src/agents/AgentRegistry';
import { TaskManager } from '../../../src/tasks/TaskManager';
import { AgentStatus } from '../../../src/agents/Agent';
import { createTask } from '../../../src/tasks/Task';
import type { Agent } from '../../../src/agents/Agent';

describe('AssignmentCommands', () => {
  let mockChannel: any;
  let mockRegistry: AgentRegistry;
  let mockTaskManager: TaskManager;
  const userId = 'user123';

  const createMockAgent = (
    id: string,
    role: string,
    status: AgentStatus = AgentStatus.CONNECTED
  ): Agent => ({
    id,
    role,
    platform: 'Linux',
    environment: 'local',
    capabilities: {
      canExecuteCode: true,
      canReadFiles: true,
      canWriteFiles: true,
    },
    status,
    currentTask: null,
    registeredAt: new Date(),
    lastSeenAt: new Date(),
  });

  beforeEach(() => {
    mockChannel = {
      sendText: vi.fn().mockResolvedValue(undefined),
    };
    mockRegistry = new AgentRegistry({ enableTimeoutChecking: false });
    mockTaskManager = new TaskManager();
  });

  describe('assignTask', () => {
    it('should create and assign task to agent', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await assignTask(
        ['assign', 'T1', 'fix', 'login', 'bug'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('assigned')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T1')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('fix login bug')
      );
    });

    it('should generate UUID for task', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await assignTask(
        ['assign', 'T1', 'test', 'task'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      // Verify task was added with UUID
      const queue = mockTaskManager.getQueue('T1');
      expect(queue.length).toBe(1);
      expect(queue[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should handle agent not found', async () => {
      await assignTask(
        ['assign', 'T99', 'some', 'task'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T99')
      );
    });

    it('should handle missing registry', async () => {
      await assignTask(
        ['assign', 'T1', 'task'],
        userId,
        mockChannel,
        undefined,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });

    it('should handle missing task manager', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await assignTask(
        ['assign', 'T1', 'task'],
        userId,
        mockChannel,
        mockRegistry,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Task manager not available')
      );
    });

    it('should handle queue full error', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));
      const smallTaskManager = new TaskManager({ maxQueueSizePerAgent: 1 });

      // Fill the queue
      await assignTask(
        ['assign', 'T1', 'task', '1'],
        userId,
        mockChannel,
        mockRegistry,
        smallTaskManager
      );

      mockChannel.sendText.mockClear();

      // Try to add one more
      await assignTask(
        ['assign', 'T1', 'task', '2'],
        userId,
        mockChannel,
        mockRegistry,
        smallTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('full')
      );
    });

    it('should show max limit in queue full error', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));
      const smallTaskManager = new TaskManager({ maxQueueSizePerAgent: 1 });

      await assignTask(
        ['assign', 'T1', 'task', '1'],
        userId,
        mockChannel,
        mockRegistry,
        smallTaskManager
      );

      mockChannel.sendText.mockClear();

      await assignTask(
        ['assign', 'T1', 'task', '2'],
        userId,
        mockChannel,
        mockRegistry,
        smallTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('max')
      );
    });

    it('should handle multi-word task descriptions', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await assignTask(
        ['assign', 'T1', 'implement', 'user', 'authentication', 'with', 'OAuth2'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      const queue = mockTaskManager.getQueue('T1');
      expect(queue[0].description).toBe('implement user authentication with OAuth2');
    });
  });

  describe('updatePriority', () => {
    it('should update priority with high/medium/low', async () => {
      const task = createTask('task-1', {
        description: 'Test task',
        githubIssueId: '123',
        githubIssueUrl: 'https://github.com/test/repo/issues/123',
      });
      mockTaskManager.addTask('T1', task);

      await updatePriority(
        ['priority', 'task-1', 'high'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('high')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('updated')
      );
    });

    it('should support numeric priorities 1-5', async () => {
      const task = createTask('task-1', {
        description: 'Test task',
        githubIssueId: '123',
        githubIssueUrl: 'https://github.com/test/repo/issues/123',
      });
      mockTaskManager.addTask('T1', task);

      await updatePriority(
        ['priority', 'task-1', '3'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('level 3')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('(3)')
      );
    });

    it('should handle invalid priority', async () => {
      await updatePriority(
        ['priority', 'task-1', 'invalid'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Invalid priority')
      );
    });

    it('should handle task not found', async () => {
      await updatePriority(
        ['priority', 'nonexistent', 'high'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('nonexistent')
      );
    });

    it('should handle missing task manager', async () => {
      await updatePriority(
        ['priority', 'task-1', 'high'],
        userId,
        mockChannel,
        mockRegistry,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Task manager not available')
      );
    });

    it('should map priority labels to numeric values', async () => {
      const task = createTask('task-1', {
        description: 'Test task',
        githubIssueId: '123',
        githubIssueUrl: 'https://github.com/test/repo/issues/123',
      });
      mockTaskManager.addTask('T1', task);

      await updatePriority(
        ['priority', 'task-1', 'high'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('(1)')
      );

      mockChannel.sendText.mockClear();

      await updatePriority(
        ['priority', 'task-1', 'medium'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('(3)')
      );

      mockChannel.sendText.mockClear();

      await updatePriority(
        ['priority', 'task-1', 'low'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('(5)')
      );
    });

    it('should handle case-insensitive priority values', async () => {
      const task = createTask('task-1', {
        description: 'Test task',
        githubIssueId: '123',
        githubIssueUrl: 'https://github.com/test/repo/issues/123',
      });
      mockTaskManager.addTask('T1', task);

      await updatePriority(
        ['priority', 'task-1', 'HIGH'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('high')
      );
    });
  });
});
