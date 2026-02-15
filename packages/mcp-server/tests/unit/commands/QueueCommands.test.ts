/**
 * Unit tests for QueueCommands
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  queueView,
  allTasks,
  cancelTask,
} from '../../../src/commands/handlers/QueueCommands';
import { AgentRegistry } from '../../../src/agents/AgentRegistry';
import { TaskManager } from '../../../src/tasks/TaskManager';
import { AgentStatus } from '../../../src/agents/Agent';
import { TaskStatus, createTask } from '../../../src/tasks/Task';
import type { Agent } from '../../../src/agents/Agent';

describe('QueueCommands', () => {
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

  describe('queueView', () => {
    it('should display queue for specific agent', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      // Add task to agent's queue
      const task = createTask('task-1', {
        description: 'Test task',
        githubIssueId: '123',
        githubIssueUrl: 'https://github.com/test/repo/issues/123',
      });
      mockTaskManager.addTask('T1', task);

      await queueView(
        ['queue', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T1')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Test task')
      );
    });

    it('should handle empty queue', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await queueView(
        ['queue', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('no pending tasks')
      );
    });

    it('should handle agent not found', async () => {
      await queueView(
        ['queue', 'T99'],
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
      await queueView(
        ['queue', 'T1'],
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

      await queueView(
        ['queue', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Task manager not available')
      );
    });

    it('should show task status', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      const task = createTask('task-1', {
        description: 'Test task',
        githubIssueId: '123',
        githubIssueUrl: 'https://github.com/test/repo/issues/123',
      });
      mockTaskManager.addTask('T1', task);

      await queueView(
        ['queue', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining(TaskStatus.AVAILABLE)
      );
    });
  });

  describe('allTasks', () => {
    it('should display all tasks grouped by agent', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));
      await mockRegistry.add(createMockAgent('T2', 'tester'));

      const task1 = createTask('task-1', {
        description: 'Task for T1',
        githubIssueId: '123',
        githubIssueUrl: 'https://github.com/test/repo/issues/123',
      });
      const task2 = createTask('task-2', {
        description: 'Task for T2',
        githubIssueId: '124',
        githubIssueUrl: 'https://github.com/test/repo/issues/124',
      });

      mockTaskManager.addTask('T1', task1);
      mockTaskManager.addTask('T2', task2);

      await allTasks(
        ['tasks'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      const response = mockChannel.sendText.mock.calls[0][0];

      expect(response).toContain('T1');
      expect(response).toContain('T2');
      expect(response).toContain('Task for T1');
      expect(response).toContain('Task for T2');
    });

    it('should handle no tasks', async () => {
      await allTasks(
        ['tasks'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('No tasks')
      );
    });

    it('should handle missing task manager', async () => {
      await allTasks(
        ['tasks'],
        userId,
        mockChannel,
        mockRegistry,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Task manager not available')
      );
    });

    it('should show task counts', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      const task1 = createTask('task-1', {
        description: 'Task 1',
        githubIssueId: '123',
        githubIssueUrl: 'https://github.com/test/repo/issues/123',
      });
      const task2 = createTask('task-2', {
        description: 'Task 2',
        githubIssueId: '124',
        githubIssueUrl: 'https://github.com/test/repo/issues/124',
      });

      mockTaskManager.addTask('T1', task1);
      mockTaskManager.addTask('T1', task2);

      await allTasks(
        ['tasks'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('2 tasks')
      );
    });
  });

  describe('cancelTask', () => {
    it('should cancel existing task', async () => {
      const task = createTask('task-1', {
        description: 'Task to cancel',
        githubIssueId: '123',
        githubIssueUrl: 'https://github.com/test/repo/issues/123',
      });

      mockTaskManager.addTask('T1', task);

      await cancelTask(
        ['cancel', 'task-1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('cancelled')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Task to cancel')
      );
    });

    it('should handle task not found', async () => {
      await cancelTask(
        ['cancel', 'nonexistent'],
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
      await cancelTask(
        ['cancel', 'task-1'],
        userId,
        mockChannel,
        mockRegistry,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Task manager not available')
      );
    });

    it('should remove task from queue', async () => {
      const task = createTask('task-1', {
        description: 'Test task',
        githubIssueId: '123',
        githubIssueUrl: 'https://github.com/test/repo/issues/123',
      });

      mockTaskManager.addTask('T1', task);

      // Verify task exists
      expect(mockTaskManager.getTaskById('task-1')).toBeDefined();

      await cancelTask(
        ['cancel', 'task-1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      // Verify task removed
      expect(mockTaskManager.getTaskById('task-1')).toBeUndefined();
    });
  });
});
