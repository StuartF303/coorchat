/**
 * Unit tests for CommandParser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CommandParser } from '../../../src/commands/CommandParser';

describe('CommandParser', () => {
  let parser: CommandParser;

  beforeEach(() => {
    parser = new CommandParser();
  });

  describe('parse', () => {
    it('should split text into tokens', () => {
      const tokens = parser.parse('list agents');
      expect(tokens).toEqual(['list', 'agents']);
    });

    it('should handle multiple spaces', () => {
      const tokens = parser.parse('config  T14   model    opus');
      expect(tokens).toEqual(['config', 'T14', 'model', 'opus']);
    });

    it('should trim leading and trailing spaces', () => {
      const tokens = parser.parse('  status T14  ');
      expect(tokens).toEqual(['status', 'T14']);
    });

    it('should return empty array for empty input', () => {
      const tokens = parser.parse('');
      expect(tokens).toEqual([]);
    });

    it('should return empty array for whitespace only', () => {
      const tokens = parser.parse('   ');
      expect(tokens).toEqual([]);
    });
  });

  describe('extractCommandName', () => {
    it('should extract command name from first token', () => {
      const tokens = ['list', 'agents'];
      const name = parser.extractCommandName(tokens);
      expect(name).toBe('list');
    });

    it('should convert command name to lowercase', () => {
      const tokens = ['LIST', 'AGENTS'];
      const name = parser.extractCommandName(tokens);
      expect(name).toBe('list');
    });

    it('should handle @mention syntax', () => {
      const tokens = ['@T14', 'hello'];
      const name = parser.extractCommandName(tokens);
      expect(name).toBe('direct-message');
    });

    it('should return empty string for empty tokens', () => {
      const tokens: string[] = [];
      const name = parser.extractCommandName(tokens);
      expect(name).toBe('');
    });
  });

  describe('extractAgentId', () => {
    it('should extract agent ID from @mention', () => {
      const tokens = ['@T14', 'hello'];
      const agentId = parser.extractAgentId(tokens, 'direct-message');
      expect(agentId).toBe('T14');
    });

    it('should extract agent ID from second token', () => {
      const tokens = ['status', 'T14'];
      const agentId = parser.extractAgentId(tokens, 'status');
      expect(agentId).toBe('T14');
    });

    it('should extract agent ID with hyphens', () => {
      const tokens = ['status', 'agent-001'];
      const agentId = parser.extractAgentId(tokens, 'status');
      expect(agentId).toBe('agent-001');
    });

    it('should extract agent ID with underscores', () => {
      const tokens = ['status', 'agent_001'];
      const agentId = parser.extractAgentId(tokens, 'status');
      expect(agentId).toBe('agent_001');
    });

    it('should return undefined if no valid agent ID', () => {
      const tokens = ['status'];
      const agentId = parser.extractAgentId(tokens, 'status');
      expect(agentId).toBeUndefined();
    });

    it('should return undefined for invalid pattern', () => {
      const tokens = ['status', 'not-an-id!'];
      const agentId = parser.extractAgentId(tokens, 'status');
      expect(agentId).toBeUndefined();
    });
  });

  describe('sanitize', () => {
    it('should remove control characters', () => {
      const input = 'hello\x00world\x1F';
      const sanitized = parser.sanitize(input);
      expect(sanitized).toBe('helloworld');
    });

    it('should preserve normal text', () => {
      const input = 'list agents @T14';
      const sanitized = parser.sanitize(input);
      expect(sanitized).toBe(input);
    });

    it('should truncate long messages', () => {
      const input = 'a'.repeat(6000);
      const sanitized = parser.sanitize(input);
      expect(sanitized.length).toBe(5000);
    });
  });

  describe('validateArgs', () => {
    it('should pass with correct arg count', () => {
      const tokens = ['command', 'arg1', 'arg2'];
      const isValid = parser.validateArgs(tokens, 2, 2);
      expect(isValid).toBe(true);
    });

    it('should pass with args between min and max', () => {
      const tokens = ['command', 'arg1', 'arg2'];
      const isValid = parser.validateArgs(tokens, 1, 3);
      expect(isValid).toBe(true);
    });

    it('should fail with too few args', () => {
      const tokens = ['command', 'arg1'];
      const isValid = parser.validateArgs(tokens, 2, 3);
      expect(isValid).toBe(false);
    });

    it('should fail with too many args', () => {
      const tokens = ['command', 'arg1', 'arg2', 'arg3', 'arg4'];
      const isValid = parser.validateArgs(tokens, 1, 3);
      expect(isValid).toBe(false);
    });

    it('should handle unlimited max args', () => {
      const tokens = ['command', ...Array(100).fill('arg')];
      const isValid = parser.validateArgs(tokens, 1);
      expect(isValid).toBe(true);
    });

    it('should handle zero args requirement', () => {
      const tokens = ['command'];
      const isValid = parser.validateArgs(tokens, 0, 0);
      expect(isValid).toBe(true);
    });
  });
});
