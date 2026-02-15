/**
 * Unit tests for ConfigCommands
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  config,
  pause,
  resume,
} from '../../../src/commands/handlers/ConfigCommands';
import { AgentRegistry } from '../../../src/agents/AgentRegistry';
import { AgentStatus } from '../../../src/agents/Agent';
import type { Agent } from '../../../src/agents/Agent';

describe('ConfigCommands', () => {
  let mockChannel: any;
  let mockRegistry: AgentRegistry;
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
  });

  describe('config model', () => {
    it('should update agent model', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'model', 'opus'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('opus')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('model')
      );
    });

    it('should reject invalid model', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'model', 'invalid-model'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Invalid')
      );
    });

    it('should require model parameter', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'model'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Model name required')
      );
    });

    it('should list valid models in error', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'model', 'invalid'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('sonnet')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('opus')
      );
    });
  });

  describe('config role', () => {
    it('should update agent role', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'role', 'reviewer'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('reviewer')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('role')
      );
    });

    it('should require role parameter', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'role'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Role name required')
      );
    });
  });

  describe('config queue-limit', () => {
    it('should update queue limit', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'queue-limit', '100'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('100')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('queue-limit')
      );
    });

    it('should validate limit is numeric', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'queue-limit', 'abc'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Invalid')
      );
    });

    it('should enforce minimum limit (1)', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'queue-limit', '0'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('out of range')
      );
    });

    it('should enforce maximum limit (1000)', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'queue-limit', '2000'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('out of range')
      );
    });

    it('should require limit parameter', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'queue-limit'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Queue limit required')
      );
    });
  });

  describe('config show', () => {
    it('should display agent configuration', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'show'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T1')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Configuration')
      );
    });

    it('should show agent role', async () => {
      await mockRegistry.add(createMockAgent('T1', 'qa-engineer'));

      await config(
        ['config', 'T1', 'show'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('qa-engineer')
      );
    });
  });

  describe('config errors', () => {
    it('should handle agent not found', async () => {
      await config(
        ['config', 'T99', 'show'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
    });

    it('should handle missing registry', async () => {
      await config(
        ['config', 'T1', 'show'],
        userId,
        mockChannel,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });

    it('should handle unknown subcommand', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await config(
        ['config', 'T1', 'unknown'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Unknown')
      );
    });
  });

  describe('pause command', () => {
    it('should pause agent', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await pause(
        ['pause', 'T1'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('paused')
      );

      // Verify status was updated
      const agent = mockRegistry.getById('T1');
      expect(agent?.status).toBe(AgentStatus.PAUSED);
    });

    it('should handle agent not found', async () => {
      await pause(
        ['pause', 'T99'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
    });

    it('should handle missing registry', async () => {
      await pause(
        ['pause', 'T1'],
        userId,
        mockChannel,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });
  });

  describe('resume command', () => {
    it('should resume paused agent', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer', AgentStatus.PAUSED));

      await resume(
        ['resume', 'T1'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('resumed')
      );

      // Verify status was updated
      const agent = mockRegistry.getById('T1');
      expect(agent?.status).toBe(AgentStatus.CONNECTED);
    });

    it('should handle agent not found', async () => {
      await resume(
        ['resume', 'T99'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
    });

    it('should handle missing registry', async () => {
      await resume(
        ['resume', 'T1'],
        userId,
        mockChannel,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });
  });
});
