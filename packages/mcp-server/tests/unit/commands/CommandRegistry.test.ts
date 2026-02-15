/**
 * Unit tests for CommandRegistry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRegistry } from '../../../src/commands/CommandRegistry';
import type { CommandDef } from '../../../src/commands/types';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;
  let mockChannel: any;

  beforeEach(() => {
    mockChannel = {
      sendText: vi.fn().mockResolvedValue(undefined),
    };
    registry = new CommandRegistry(mockChannel);
  });

  describe('register', () => {
    it('should register a command', () => {
      const commandDef: CommandDef = {
        minArgs: 0,
        description: 'Test command',
        execute: vi.fn(),
      };

      registry.register('test', commandDef);
      const commands = registry.getAllCommands();
      expect(commands.has('test')).toBe(true);
    });

    it('should register command aliases', () => {
      const commandDef: CommandDef = {
        minArgs: 0,
        description: 'Test command',
        aliases: ['t', 'tst'],
        execute: vi.fn(),
      };

      registry.register('test', commandDef);
      const commands = registry.getAllCommands();
      expect(commands.has('test')).toBe(true);
      expect(commands.has('t')).toBe(true);
      expect(commands.has('tst')).toBe(true);
    });

    it('should handle case-insensitive registration', () => {
      const commandDef: CommandDef = {
        minArgs: 0,
        description: 'Test command',
        execute: vi.fn(),
      };

      registry.register('TEST', commandDef);
      const commands = registry.getAllCommands();
      expect(commands.has('test')).toBe(true);
    });
  });

  describe('handleCommand', () => {
    it('should execute registered command', async () => {
      const executeFn = vi.fn().mockResolvedValue(undefined);
      const commandDef: CommandDef = {
        minArgs: 0,
        description: 'Test command',
        execute: executeFn,
      };

      registry.register('test', commandDef);
      await registry.handleCommand('test', 'user123');

      expect(executeFn).toHaveBeenCalledWith(
        ['test'],
        'user123',
        mockChannel,
        undefined,
        undefined,
        registry
      );
    });

    it('should handle unknown command with suggestion', async () => {
      const commandDef: CommandDef = {
        minArgs: 0,
        description: 'List command',
        execute: vi.fn(),
      };

      registry.register('list', commandDef);
      await registry.handleCommand('lst', 'user123');

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Unknown command')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('list')
      );
    });

    it('should handle command with too few args', async () => {
      const commandDef: CommandDef = {
        minArgs: 2,
        description: 'Test command',
        examples: ['test arg1 arg2'],
        execute: vi.fn(),
      };

      registry.register('test', commandDef);
      await registry.handleCommand('test arg1', 'user123');

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('requires at least 2 arguments')
      );
    });

    it('should handle command with too many args', async () => {
      const commandDef: CommandDef = {
        minArgs: 1,
        maxArgs: 2,
        description: 'Test command',
        execute: vi.fn(),
      };

      registry.register('test', commandDef);
      await registry.handleCommand('test arg1 arg2 arg3', 'user123');

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('accepts at most 2 arguments')
      );
    });

    it('should handle command execution errors', async () => {
      const commandDef: CommandDef = {
        minArgs: 0,
        description: 'Test command',
        execute: vi.fn().mockRejectedValue(new Error('Test error')),
      };

      registry.register('test', commandDef);
      await registry.handleCommand('test', 'user123');

      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Error executing command')
      );
      expect(mockChannel.sendText).toHaveBeenCalledWith(
        expect.stringContaining('Test error')
      );
    });

    it('should handle empty messages', async () => {
      await registry.handleCommand('', 'user123');
      expect(mockChannel.sendText).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive command names', async () => {
      const executeFn = vi.fn().mockResolvedValue(undefined);
      const commandDef: CommandDef = {
        minArgs: 0,
        description: 'Test command',
        execute: executeFn,
      };

      registry.register('list', commandDef);
      await registry.handleCommand('LIST', 'user123');

      expect(executeFn).toHaveBeenCalled();
    });

    it('should sanitize input before processing', async () => {
      const executeFn = vi.fn().mockResolvedValue(undefined);
      const commandDef: CommandDef = {
        minArgs: 0,
        description: 'Test command',
        execute: executeFn,
      };

      registry.register('test', commandDef);
      await registry.handleCommand('test\x00\x1F', 'user123');

      // Should still execute despite control chars
      expect(executeFn).toHaveBeenCalled();
    });
  });

  describe('getAllCommands', () => {
    it('should return all registered commands', () => {
      const cmd1: CommandDef = {
        minArgs: 0,
        description: 'Command 1',
        execute: vi.fn(),
      };
      const cmd2: CommandDef = {
        minArgs: 0,
        description: 'Command 2',
        execute: vi.fn(),
      };

      registry.register('test1', cmd1);
      registry.register('test2', cmd2);

      const commands = registry.getAllCommands();
      expect(commands.size).toBeGreaterThanOrEqual(2);
      expect(commands.has('test1')).toBe(true);
      expect(commands.has('test2')).toBe(true);
    });
  });
});
