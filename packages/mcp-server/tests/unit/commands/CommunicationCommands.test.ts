/**
 * Unit tests for CommunicationCommands
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  directMessage,
  broadcast,
  ask,
  handleResponseTimeout,
} from '../../../src/commands/handlers/CommunicationCommands';
import { AgentRegistry } from '../../../src/agents/AgentRegistry';
import { AgentStatus } from '../../../src/agents/Agent';
import type { Agent } from '../../../src/agents/Agent';

describe('CommunicationCommands', () => {
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

  describe('directMessage', () => {
    it('should send message to specific agent', async () => {
      await mockRegistry.add(createMockAgent('T14', 'developer'));

      await directMessage(
        ['@T14', 'what', 'are', 'you', 'working', 'on?'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T14')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('what are you working on?')
      );
    });

    it('should handle agent not found', async () => {
      await directMessage(
        ['@T99', 'hello'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T99')
      );
    });

    it('should handle missing message text', async () => {
      await mockRegistry.add(createMockAgent('T14', 'developer'));

      await directMessage(['@T14'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Message text required')
      );
    });

    it('should handle missing registry', async () => {
      await directMessage(
        ['@T14', 'hello'],
        userId,
        mockChannel,
        undefined
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });

    it('should handle multi-word messages', async () => {
      await mockRegistry.add(createMockAgent('T14', 'developer'));

      await directMessage(
        ['@T14', 'This', 'is', 'a', 'long', 'message', 'with', 'many', 'words'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('This is a long message with many words')
      );
    });
  });

  describe('broadcast', () => {
    it('should broadcast to all connected agents', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));
      await mockRegistry.add(createMockAgent('T2', 'tester'));

      await broadcast(
        ['broadcast', 'hello', 'everyone'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('2 agent')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('hello everyone')
      );
    });

    it('should handle empty agent pool', async () => {
      await broadcast(
        ['broadcast', 'hello'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('No agents')
      );
    });

    it('should only broadcast to connected agents', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));
      await mockRegistry.add(
        createMockAgent('T2', 'tester', AgentStatus.DISCONNECTED)
      );

      await broadcast(
        ['broadcast', 'test'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('1 agent')
      );
    });

    it('should handle missing message text', async () => {
      await mockRegistry.add(createMockAgent('T1', 'developer'));

      await broadcast(['broadcast'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Message text required')
      );
    });

    it('should handle missing registry', async () => {
      await broadcast(['broadcast', 'hello'], userId, mockChannel, undefined);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });
  });

  describe('ask', () => {
    it('should send question to specific agent', async () => {
      await mockRegistry.add(createMockAgent('T14', 'developer'));

      await ask(
        ['ask', 'T14', 'what', 'is', 'your', 'current', 'task?'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T14')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('what is your current task?')
      );
    });

    it('should handle agent not found', async () => {
      await ask(
        ['ask', 'T99', 'hello'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T99')
      );
    });

    it('should handle missing agent ID', async () => {
      await ask(['ask'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Agent ID required')
      );
    });

    it('should handle missing question text', async () => {
      await mockRegistry.add(createMockAgent('T14', 'developer'));

      await ask(['ask', 'T14'], userId, mockChannel, mockRegistry);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Question text required')
      );
    });

    it('should handle missing registry', async () => {
      await ask(['ask', 'T14', 'hello'], userId, mockChannel, undefined);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('registry not available')
      );
    });

    it('should handle multi-word questions', async () => {
      await mockRegistry.add(createMockAgent('T14', 'developer'));

      await ask(
        ['ask', 'T14', 'Can', 'you', 'explain', 'your', 'approach?'],
        userId,
        mockChannel,
        mockRegistry
      );

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Can you explain your approach?')
      );
    });
  });

  describe('handleResponseTimeout', () => {
    it('should send timeout warning', async () => {
      await handleResponseTimeout('T14', mockChannel);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('T14')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('did not respond')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('30 seconds')
      );
    });

    it('should suggest checking agent status', async () => {
      await handleResponseTimeout('agent-001', mockChannel);

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('status agent-001')
      );
    });
  });
});
