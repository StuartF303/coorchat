/**
 * CommandParser
 * Parses natural language text commands into structured Command objects
 */

import type { Command, CommandType } from './types.js';

export class CommandParser {
  /**
   * Parse text input into tokens
   * @param text Raw text from Slack message
   * @returns Array of tokens (words)
   */
  parse(text: string): string[] {
    const startTime = performance.now();

    const trimmed = text.trim();
    if (!trimmed) {
      return [];
    }

    // Split on whitespace
    const tokens = trimmed.split(/\s+/);

    // Track parsing performance
    const duration = performance.now() - startTime;
    if (duration > 50) {
      console.warn(`Command parsing took ${duration.toFixed(2)}ms (threshold: 50ms)`, {
        text: text.substring(0, 100),
        tokenCount: tokens.length,
      });
    }

    return tokens;
  }

  /**
   * Extract command name from tokens
   * Handles special cases like @mentions
   * @param tokens Array of words
   * @returns Command name (lowercase)
   */
  extractCommandName(tokens: string[]): string {
    if (tokens.length === 0) {
      return '';
    }

    const firstToken = tokens[0];

    // Handle @mention syntax
    if (firstToken.startsWith('@')) {
      return 'direct-message';
    }

    // Normalize to lowercase for case-insensitive matching
    return firstToken.toLowerCase();
  }

  /**
   * Extract target agent ID from command
   * Used for commands like "@T14 message" or "status T14"
   * @param tokens Array of words
   * @param commandName Command being executed
   * @returns Agent ID or undefined
   */
  extractAgentId(tokens: string[], commandName: string): string | undefined {
    if (commandName === 'direct-message' && tokens[0]?.startsWith('@')) {
      // Remove @ prefix
      return tokens[0].substring(1);
    }

    // For commands like "status T14", "config T14", etc.
    // Agent ID is typically the second token
    if (tokens.length > 1) {
      const potentialAgentId = tokens[1];
      // Agent IDs match pattern: uppercase alphanumeric, underscore, hyphen
      if (/^[A-Z0-9_-]+$/i.test(potentialAgentId)) {
        return potentialAgentId;
      }
    }

    return undefined;
  }

  /**
   * Sanitize input to prevent command injection
   * @param text Raw input text
   * @returns Sanitized text
   */
  sanitize(text: string): string {
    // Remove control characters
    let sanitized = text.replace(/[\x00-\x1F\x7F]/g, '');

    // Limit length to prevent abuse
    const maxLength = 5000;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Validate command syntax
   * @param tokens Array of tokens
   * @param minArgs Minimum required arguments
   * @param maxArgs Maximum allowed arguments (optional)
   * @returns True if valid
   */
  validateArgs(tokens: string[], minArgs: number, maxArgs?: number): boolean {
    const argCount = tokens.length - 1; // Exclude command name

    if (argCount < minArgs) {
      return false;
    }

    if (maxArgs !== undefined && argCount > maxArgs) {
      return false;
    }

    return true;
  }
}
