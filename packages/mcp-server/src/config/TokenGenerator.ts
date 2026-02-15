/**
 * TokenGenerator - Generate secure random tokens for authentication
 * Uses crypto.randomBytes for cryptographically secure token generation
 */

import { randomBytes, createHash } from 'crypto';

/**
 * Token generation options
 */
export interface TokenOptions {
  /** Token length in bytes (default: 32) */
  length?: number;

  /** Output encoding (default: 'hex') */
  encoding?: 'hex' | 'base64' | 'base64url';

  /** Whether to include a prefix */
  prefix?: string;
}

/**
 * TokenGenerator class
 */
export class TokenGenerator {
  /**
   * Generate a secure random token
   */
  static generate(options: TokenOptions = {}): string {
    const {
      length = 32,
      encoding = 'hex',
      prefix = '',
    } = options;

    // Generate random bytes
    const bytes = randomBytes(length);

    // Convert to string based on encoding
    let token: string;
    switch (encoding) {
      case 'hex':
        token = bytes.toString('hex');
        break;
      case 'base64':
        token = bytes.toString('base64');
        break;
      case 'base64url':
        token = bytes.toString('base64url');
        break;
      default:
        token = bytes.toString('hex');
    }

    // Add prefix if specified
    return prefix ? `${prefix}${token}` : token;
  }

  /**
   * Generate a channel token (128-bit security)
   */
  static generateChannelToken(): string {
    return this.generate({
      length: 32,
      encoding: 'hex',
      prefix: 'cct_',
    });
  }

  /**
   * Generate an API token (256-bit security)
   */
  static generateAPIToken(): string {
    return this.generate({
      length: 64,
      encoding: 'base64url',
      prefix: 'cca_',
    });
  }

  /**
   * Generate a webhook secret (256-bit security)
   */
  static generateWebhookSecret(): string {
    return this.generate({
      length: 64,
      encoding: 'hex',
    });
  }

  /**
   * Hash a token (for secure storage)
   */
  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validate token format
   */
  static validateFormat(token: string, options: {
    minLength?: number;
    prefix?: string;
  } = {}): boolean {
    const { minLength = 16, prefix } = options;

    // Check for null/undefined
    if (!token) {
      return false;
    }

    // Check minimum length
    if (token.length < minLength) {
      return false;
    }

    // Check prefix if specified
    if (prefix && !token.startsWith(prefix)) {
      return false;
    }

    // Check for valid characters (alphanumeric + URL-safe characters)
    if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
      return false;
    }

    return true;
  }

  /**
   * Generate a nonce (number used once)
   */
  static generateNonce(): string {
    return this.generate({
      length: 16,
      encoding: 'hex',
    });
  }

  /**
   * Generate multiple tokens at once
   */
  static generateBatch(count: number, options: TokenOptions = {}): string[] {
    const tokens: string[] = [];
    for (let i = 0; i < count; i++) {
      tokens.push(this.generate(options));
    }
    return tokens;
  }
}

/**
 * Convenience function to generate a token
 */
export function generateToken(options?: TokenOptions): string {
  return TokenGenerator.generate(options);
}

/**
 * Convenience function to generate a channel token
 */
export function generateChannelToken(): string {
  return TokenGenerator.generateChannelToken();
}

/**
 * Convenience function to hash a token
 */
export function hashToken(token: string): string {
  return TokenGenerator.hash(token);
}
