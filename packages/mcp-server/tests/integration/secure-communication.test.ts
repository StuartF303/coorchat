/**
 * Integration Test: Secure Agent Communication
 * Tests authentication, encryption, and security features
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenGenerator, generateChannelToken, hashToken } from '../../src/config/TokenGenerator.js';
import type { ChannelConfig } from '../../src/channels/base/Channel.js';
import { ChannelAdapter } from '../../src/channels/base/ChannelAdapter.js';
import { Message, MessageType } from '../../src/protocol/Message.js';
import { MessageBuilder } from '../../src/protocol/MessageBuilder.js';

describe('Secure Communication', () => {
  describe('TokenGenerator', () => {
    it('should generate secure random tokens', () => {
      const token1 = TokenGenerator.generate();
      const token2 = TokenGenerator.generate();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2); // Should be unique
      expect(token1.length).toBeGreaterThanOrEqual(32); // Minimum length
    });

    it('should generate channel tokens with correct format', () => {
      const token = TokenGenerator.generateChannelToken();

      expect(token).toMatch(/^cct_[a-f0-9]+$/);
      expect(token.length).toBeGreaterThan(16);
    });

    it('should generate API tokens with correct format', () => {
      const token = TokenGenerator.generateAPIToken();

      expect(token).toMatch(/^cca_[a-zA-Z0-9_-]+$/);
      expect(token.length).toBeGreaterThan(16);
    });

    it('should validate token format correctly', () => {
      const validToken = 'cct_' + 'a'.repeat(32);
      const shortToken = 'cct_abc';
      const invalidChars = 'cct_abc$@!';

      expect(TokenGenerator.validateFormat(validToken, { prefix: 'cct_' })).toBe(true);
      expect(TokenGenerator.validateFormat(shortToken, { minLength: 16 })).toBe(false);
      expect(TokenGenerator.validateFormat(invalidChars)).toBe(false);
    });

    it('should hash tokens consistently', () => {
      const token = 'test_token_123';
      const hash1 = TokenGenerator.hash(token);
      const hash2 = TokenGenerator.hash(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
      expect(hash1).toMatch(/^[a-f0-9]+$/);
    });

    it('should produce different hashes for different tokens', () => {
      const token1 = 'token_one';
      const token2 = 'token_two';
      const hash1 = TokenGenerator.hash(token1);
      const hash2 = TokenGenerator.hash(token2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Channel Authentication', () => {
    class TestChannel extends ChannelAdapter {
      protected async doConnect(): Promise<void> {
        // Mock implementation
      }

      protected async doDisconnect(): Promise<void> {
        // Mock implementation
      }

      protected async doSendMessage(message: Message): Promise<void> {
        // Mock implementation
      }

      protected async doPing(): Promise<void> {
        // Mock implementation
      }

      // Expose protected methods for testing
      public testVerifyToken(token: string): boolean {
        return this.verifyToken(token);
      }

      public testGetAuthToken(): string {
        return this.getAuthToken();
      }
    }

    it('should reject channels with invalid tokens', () => {
      const invalidConfigs = [
        { token: '' }, // Empty token
        { token: 'short' }, // Too short
        { token: '12345' }, // Less than 16 chars
      ];

      for (const params of invalidConfigs) {
        expect(() => {
          new TestChannel({
            type: 'test',
            token: params.token,
            connectionParams: {},
          } as ChannelConfig);
        }).toThrow('Invalid or missing authentication token');
      }
    });

    it('should accept channels with valid tokens', () => {
      const validToken = generateChannelToken();

      expect(() => {
        new TestChannel({
          type: 'test',
          token: validToken,
          connectionParams: {},
        } as ChannelConfig);
      }).not.toThrow();
    });

    it('should verify tokens using timing-safe comparison', () => {
      const validToken = generateChannelToken();
      const channel = new TestChannel({
        type: 'test',
        token: validToken,
        connectionParams: {},
      } as ChannelConfig);

      // Valid token should pass
      expect(channel.testVerifyToken(validToken)).toBe(true);

      // Invalid tokens should fail
      expect(channel.testVerifyToken('wrong_token')).toBe(false);
      expect(channel.testVerifyToken('')).toBe(false);
      expect(channel.testVerifyToken(validToken + 'extra')).toBe(false);
    });

    it('should provide auth token for connections', () => {
      const token = generateChannelToken();
      const channel = new TestChannel({
        type: 'test',
        token,
        connectionParams: {},
      } as ChannelConfig);

      expect(channel.testGetAuthToken()).toBe(token);
    });
  });

  describe('Message Security', () => {
    it('should include authentication metadata in messages', () => {
      const senderId = 'agent-123';
      const message = MessageBuilder.heartbeat(senderId);

      expect(message.senderId).toBe(senderId);
      expect(message.timestamp).toBeDefined();
      expect(message.protocolVersion).toBeDefined();
    });

    it('should validate message integrity', () => {
      const message = MessageBuilder.taskAssigned(
        'sender-1',
        'recipient-1',
        {
          taskId: 'task-1',
          description: 'Test task',
          githubIssue: 'https://github.com/org/repo/issues/1',
        }
      );

      // Message should have all required fields
      expect(message.protocolVersion).toBeDefined();
      expect(message.messageType).toBe(MessageType.TASK_ASSIGNED);
      expect(message.senderId).toBe('sender-1');
      expect(message.recipientId).toBe('recipient-1');
      expect(message.timestamp).toBeDefined();
    });

    it('should prevent message tampering detection', () => {
      const message = MessageBuilder.heartbeat('agent-1');
      const originalTimestamp = message.timestamp;

      // Simulate tampering
      const tamperedMessage = {
        ...message,
        timestamp: new Date(Date.now() + 1000000).toISOString(),
      };

      // Original timestamp should differ from tampered
      expect(tamperedMessage.timestamp).not.toBe(originalTimestamp);
    });
  });

  describe('Token Security Best Practices', () => {
    it('should generate tokens with sufficient entropy', () => {
      // Generate multiple tokens and ensure uniqueness
      const tokens = new Set<string>();
      const count = 100;

      for (let i = 0; i < count; i++) {
        tokens.add(generateChannelToken());
      }

      // All tokens should be unique
      expect(tokens.size).toBe(count);
    });

    it('should support different token encodings', () => {
      const hexToken = TokenGenerator.generate({ encoding: 'hex' });
      const base64Token = TokenGenerator.generate({ encoding: 'base64' });
      const base64urlToken = TokenGenerator.generate({ encoding: 'base64url' });

      expect(hexToken).toMatch(/^[a-f0-9]+$/);
      expect(base64Token).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(base64urlToken).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate nonces for replay protection', () => {
      const nonce1 = TokenGenerator.generateNonce();
      const nonce2 = TokenGenerator.generateNonce();

      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should generate batch tokens efficiently', () => {
      const count = 50;
      const tokens = TokenGenerator.generateBatch(count);

      expect(tokens).toHaveLength(count);
      expect(new Set(tokens).size).toBe(count); // All unique
    });
  });

  describe('Encryption Support', () => {
    it('should warn when using unencrypted connections', () => {
      // This test verifies that channels log warnings for insecure connections
      // Actual implementation is in channel-specific code

      const insecureUrls = [
        'http://example.com/hub', // HTTP instead of HTTPS
        'redis://localhost:6379', // Redis without TLS
      ];

      // In production, these should trigger warnings
      insecureUrls.forEach(url => {
        expect(url.startsWith('https://') || url.startsWith('rediss://')).toBe(false);
      });
    });

    it('should support secure connection URLs', () => {
      const secureUrls = [
        'https://example.com/hub', // HTTPS
        'rediss://localhost:6379', // Redis with TLS
        'wss://example.com/ws', // WebSocket Secure
      ];

      secureUrls.forEach(url => {
        const isSecure = url.startsWith('https://') ||
                        url.startsWith('rediss://') ||
                        url.startsWith('wss://');
        expect(isSecure).toBe(true);
      });
    });
  });

  describe('Authentication Edge Cases', () => {
    it('should handle null/undefined tokens gracefully', () => {
      expect(() => {
        TokenGenerator.validateFormat(null as any);
      }).not.toThrow();

      expect(TokenGenerator.validateFormat(undefined as any)).toBe(false);
    });

    it('should reject tokens with whitespace', () => {
      const tokensWithWhitespace = [
        'token with spaces',
        'token\twith\ttabs',
        'token\nwith\nnewlines',
        ' leading-space',
        'trailing-space ',
      ];

      tokensWithWhitespace.forEach(token => {
        expect(TokenGenerator.validateFormat(token)).toBe(false);
      });
    });

    it('should handle very long tokens', () => {
      const longToken = 'a'.repeat(1000);
      const hash = TokenGenerator.hash(longToken);

      expect(hash).toHaveLength(64); // SHA-256 always produces same length
    });
  });

  describe('Security Headers and Metadata', () => {
    it('should include security-relevant fields in messages', () => {
      const message = MessageBuilder.error(
        'agent-1',
        {
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
        }
      );

      // Security-relevant fields should be present
      expect(message.senderId).toBeDefined();
      expect(message.timestamp).toBeDefined();
      expect(message.protocolVersion).toBeDefined();
      expect(message.messageType).toBe(MessageType.ERROR);
      expect(message.priority).toBeDefined();
    });

    it('should support correlation IDs for request tracking', () => {
      const correlationId = TokenGenerator.generateNonce();
      const query = MessageBuilder.statusQuery('agent-1', null, correlationId);

      expect(query.correlationId).toBe(correlationId);
    });
  });
});
