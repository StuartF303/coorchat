/**
 * Unit tests for MonitoringCommands
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  logs,
  metrics,
  errors,
  history,
} from '../../../src/commands/handlers/MonitoringCommands';
import { AgentRegistry } from '../../../src/agents/AgentRegistry';
import { TaskManager } from '../../../src/tasks/TaskManager';
import { AgentStatus } from '../../../src/agents/Agent';
import { createTask } from '../../../src/tasks/Task';
import type { Agent } from '../../../src/agents/Agent';

describe('MonitoringCommands', () => {
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

  describe('logs command', () => {
    it('should retrieve logs for agent', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await logs(
        ['logs', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T1')
      );
    });

    it('should support custom log count', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await logs(
        ['logs', 'T1', '10'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalled();
    });

    it('should use default count (50) when not specified', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await logs(
        ['logs', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      // Should accept command without count parameter
      expect(mockChannel.sendText).toHaveBeenCalled();
    });

    it('should validate log count is numeric', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await logs(
        ['logs', 'T1', 'abc'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Invalid')
      );
    });

    it('should handle agent not found', async () => {
      await logs(
        ['logs', 'T99'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
    });

    it('should handle missing registry', async () => {
      await logs(
        ['logs', 'T1'],
        userId,
        mockChannel,
        undefined,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });
  });

  describe('metrics command', () => {
    it('should display agent metrics', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await metrics(
        ['metrics', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T1')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Metrics')
      );
    });

    it('should show task counts', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      // Add a task
      const task = createTask('task-1', {
        description: 'Test task',
        githubIssueId: '123',
        githubIssueUrl: 'https://github.com/test/repo/issues/123',
      });
      mockTaskManager.addTask('T1', task);

      await metrics(
        ['metrics', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Tasks')
      );
    });

    it('should show agent role', async () => {
      await mockRegistry.add(createMockAgent('T1', 'qa-engineer'));

      await metrics(
        ['metrics', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('qa-engineer')
      );
    });

    it('should show agent status', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer', AgentStatus.CONNECTED));

      await metrics(
        ['metrics', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('connected')
      );
    });

    it('should handle agent not found', async () => {
      await metrics(
        ['metrics', 'T99'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
    });

    it('should handle missing registry', async () => {
      await metrics(
        ['metrics', 'T1'],
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

      await metrics(
        ['metrics', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Task manager not available')
      );
    });
  });

  describe('errors command', () => {
    it('should show recent errors', async () => {
      await errors(
        ['errors'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalled();
    });

    it('should work without registry', async () => {
      // errors command doesn't require registry (shows errors from all agents)
      await errors(
        ['errors'],
        userId,
        mockChannel,
        undefined,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalled();
    });
  });

  describe('history command', () => {
    it('should show task history for agent', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await history(
        ['history', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T1')
      );
    });

    it('should handle agent not found', async () => {
      await history(
        ['history', 'T99'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
    });

    it('should handle missing registry', async () => {
      await history(
        ['history', 'T1'],
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

      await history(
        ['history', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Task manager not available')
      );
    });
  });
});
