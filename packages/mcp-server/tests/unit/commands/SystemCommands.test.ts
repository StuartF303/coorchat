/**
 * Unit tests for SystemCommands
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  help,
  version,
  restart,
  shutdown,
} from '../../../src/commands/handlers/SystemCommands';
import { AgentRegistry } from '../../../src/agents/AgentRegistry';
import { TaskManager } from '../../../src/tasks/TaskManager';
import { AgentStatus } from '../../../src/agents/Agent';
import type { Agent } from '../../../src/agents/Agent';

describe('SystemCommands', () => {
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

  describe('help command', () => {
    it('should display available commands', async () => {
      await help(
        ['help'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalled();
      const response = mockChannel.sendText.mock.calls[0][0];
      expect(response).toContain('commands');
    });

    it('should work without command registry', async () => {
      // When commandRegistry not provided, should show fallback
      await help(
        ['help'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalled();
      const response = mockChannel.sendText.mock.calls[0][0];
      expect(response).toContain('Available commands');
    });

    it('should list command categories', async () => {
      await help(
        ['help'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager,
        undefined
      );

      const response = mockChannel.sendText.mock.calls[0][0];
      expect(response).toContain('Discovery');
      expect(response).toContain('Communication');
      expect(response).toContain('Queue');
      expect(response).toContain('Config');
      expect(response).toContain('Monitoring');
      expect(response).toContain('System');
    });
  });

  describe('version command', () => {
    it('should display version information', async () => {
      await version(
        ['version'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalled();
      const response = mockChannel.sendText.mock.calls[0][0];
      expect(response).toContain('Version');
    });

    it('should show MCP server version', async () => {
      await version(
        ['version'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      const response = mockChannel.sendText.mock.calls[0][0];
      expect(response).toContain('MCP Server');
      expect(response).toContain('1.0.0');
    });

    it('should show connected agent count', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));
      await mockRegistry.add(createMockAgent('T2', 'qa'));

      await version(
        ['version'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      const response = mockChannel.sendText.mock.calls[0][0];
      expect(response).toContain('Connected Agents');
      expect(response).toContain('2');
    });

    it('should work without registry', async () => {
      await version(
        ['version'],
        userId,
        mockChannel,
        undefined,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalled();
    });
  });

  describe('restart command', () => {
    it('should restart agent', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await restart(
        ['restart', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalled();
      const response = mockChannel.sendText.mock.calls[0][0];
      expect(response).toContain('T1');
      expect(response).toContain('Restart');
    });

    it('should handle agent not found', async () => {
      await restart(
        ['restart', 'T99'],
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
      await restart(
        ['restart', 'T1'],
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

  describe('shutdown command', () => {
    it('should shutdown agent', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await shutdown(
        ['shutdown', 'T1'],
        userId,
        mockChannel,
        mockRegistry,
        mockTaskManager
      );

      expect(mockChannel.sendText).toHaveBeenCalled();
      const response = mockChannel.sendText.mock.calls[0][0];
      expect(response).toContain('T1');
      expect(response).toContain('Shutdown');
    });

    it('should handle agent not found', async () => {
      await shutdown(
        ['shutdown', 'T99'],
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
      await shutdown(
        ['shutdown', 'T1'],
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
});
