/**
 * Unit tests for DiscoveryCommands
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listAgents,
  poolStatus,
  agentStatus,
  pingAll,
} from '../../../src/commands/handlers/DiscoveryCommands';
import { AgentRegistry } from '../../../src/agents/AgentRegistry';
import { AgentStatus } from '../../../src/agents/Agent';
import type { Agent } from '../../../src/agents/Agent';

describe('DiscoveryCommands', () => {
  let mockChannel: any;
  let mockRegistry: AgentRegistry;
  const userId = 'user123';

  // Helper to create mock agent
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

  describe('listAgents', () => {
    it('should send table with all agents', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));
      await mockRegistry.add(createMockAgent('T2', 'tester'));

      await listAgents(['list', 'agents'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T1')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T2')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('developer')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('tester')
      );
    });

    it('should handle empty registry', async () => {
      await listAgents(['list', 'agents'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('No agents')
      );
    });

    it('should handle missing registry', async () => {
      await listAgents(['list', 'agents'], userId, mockChannel, undefined);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });

    it('should include agent status', async () => {
      await mockRegistry.add(
        createMockAgent('T1', 'developer', AgentStatus.CONNECTED)
      );
      await mockRegistry.add(
        createMockAgent('T2', 'tester', AgentStatus.DISCONNECTED)
      );

      await listAgents(['list', 'agents'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('connected')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('disconnected')
      );
    });

    it('should include current task', async () => {
      const agent = createMockAgent('T1', 'developer');
      agent.currentTask = 'task-123';
      await mockRegistry.add(agent);

      await listAgents(['list', 'agents'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('task-123')
      );
    });
  });

  describe('poolStatus', () => {
    it('should send pool summary with counts', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));
      await mockRegistry.add(createMockAgent('T2', 'tester'));
      await mockRegistry.add(
        createMockAgent('T3', 'devops', AgentStatus.DISCONNECTED)
      );

      await poolStatus(['status'], userId, mockChannel, mockRegistry);

      const response = mockChannel.sendText.mock.calls[0][0];

      // Should include total
      expect(response).toMatch(/total.*3/i);

      // Should include connected count
      expect(response).toMatch(/connected.*2/i);

      // Should include disconnected count
      expect(response).toMatch(/disconnected.*1/i);
    });

    it('should include role breakdown', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));
      await mockRegistry.add(createMockAgent('T2', 'developer'));
      await mockRegistry.add(createMockAgent('T3', 'tester'));

      await poolStatus(['status'], userId, mockChannel, mockRegistry);

      const response = mockChannel.sendText.mock.calls[0][0];

      expect(response).toContain('developer');
      expect(response).toContain('tester');
    });

    it('should handle missing registry', async () => {
      await poolStatus(['status'], userId, mockChannel, undefined);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });
  });

  describe('agentStatus', () => {
    it('should send detailed agent status', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await agentStatus(['status', 'T1'], userId, mockChannel, mockRegistry);

      const response = mockChannel.sendText.mock.calls[0][0];

      expect(response).toContain('T1');
      expect(response).toContain('developer');
      expect(response).toContain('Linux');
      expect(response).toContain('local');
      expect(response).toContain('connected');
    });

    it('should handle agent not found', async () => {
      await agentStatus(['status', 'T99'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T99')
      );
    });

    it('should handle missing agent ID', async () => {
      await agentStatus(['status'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Agent ID required')
      );
    });

    it('should handle missing registry', async () => {
      await agentStatus(['status', 'T1'], userId, mockChannel, undefined);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });

    it('should include capabilities', async () => {
      const agent = createMockAgent('T1', 'developer');
      agent.capabilities = {
        agentId: 'T1',
        roleType: 'developer',
        platform: 'Linux',
        environmentType: 'local',
        tools: ['node', 'git', 'docker'],
        languages: ['typescript', 'javascript', 'python'],
        apiAccess: ['github', 'slack'],
      };
      await mockRegistry.add(agent);

      await agentStatus(['status', 'T1'], userId, mockChannel, mockRegistry);

      const response = mockChannel.sendText.mock.calls[0][0];

      expect(response).toContain('Tools');
      expect(response).toContain('node');
      expect(response).toContain('Languages');
      expect(response).toContain('typescript');
      expect(response).toContain('API Access');
      expect(response).toContain('github');
    });

    it('should include current task if assigned', async () => {
      const agent = createMockAgent('T1', 'developer');
      agent.currentTask = 'task-abc';
      await mockRegistry.add(agent);

      await agentStatus(['status', 'T1'], userId, mockChannel, mockRegistry);

      const response = mockChannel.sendText.mock.calls[0][0];

      expect(response).toContain('task-abc');
    });

    it('should show None for no current task', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await agentStatus(['status', 'T1'], userId, mockChannel, mockRegistry);

      const response = mockChannel.sendText.mock.calls[0][0];

      expect(response).toContain('None');
    });
  });

  describe('pingAll', () => {
    it('should acknowledge ping to all agents', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));
      await mockRegistry.add(createMockAgent('T2', 'tester'));

      await pingAll(['ping', 'all'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Pinging 2')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T1')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T2')
      );
    });

    it('should handle empty registry', async () => {
      await pingAll(['ping', 'all'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('No agents')
      );
    });

    it('should only ping connected agents', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));
      await mockRegistry.add(
        createMockAgent('T2', 'tester', AgentStatus.DISCONNECTED)
      );

      await pingAll(['ping', 'all'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Pinging 1')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T1')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.not.stringContaining('T2')
      );
    });

    it('should handle missing registry', async () => {
      await pingAll(['ping', 'all'], userId, mockChannel, undefined);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });
  });
});
