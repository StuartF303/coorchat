/**
 * LogFormatter - Structured JSON logging formatter
 * Formats log entries for output to console, files, or external logging services
 */

import { LogEntry, LogLevel, LogMetadata } from './Logger.js';

/**
 * Formatting options
 */
export interface FormatOptions {
  /** Output format */
  format: 'json' | 'text';

  /** Whether to colorize output (text format only) */
  colorize?: boolean;

  /** Whether to include timestamp */
  includeTimestamp?: boolean;

  /** Whether to pretty-print JSON */
  prettyPrint?: boolean;

  /** Indent size for pretty-printing */
  indent?: number;

  /** Maximum metadata depth to include */
  maxDepth?: number;
}

/**
 * ANSI color codes for console output
 */
const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Log level colors
 */
const LevelColors: Record<LogLevel, string> = {
  [LogLevel.ERROR]: Colors.red,
  [LogLevel.WARN]: Colors.yellow,
  [LogLevel.INFO]: Colors.blue,
  [LogLevel.DEBUG]: Colors.gray,
};

/**
 * LogFormatter class
 */
export class LogFormatter {
  private options: Required<FormatOptions>;

  constructor(options: Partial<FormatOptions> = {}) {
    this.options = {
      format: 'json',
      colorize: false,
      includeTimestamp: true,
      prettyPrint: false,
      indent: 2,
      maxDepth: 5,
      ...options,
    };
  }

  /**
   * Format a log entry
   */
  format(entry: LogEntry): string {
    switch (this.options.format) {
      case 'json':
        return this.formatJSON(entry);
      case 'text':
        return this.formatText(entry);
      default:
        return this.formatJSON(entry);
    }
  }

  /**
   * Format as JSON
   */
  private formatJSON(entry: LogEntry): string {
    const obj = this.prepareEntry(entry);

    if (this.options.prettyPrint) {
      return JSON.stringify(obj, this.getReplacer(), this.options.indent);
    }

    return JSON.stringify(obj, this.getReplacer());
  }

  /**
   * Format as human-readable text
   */
  private formatText(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.options.includeTimestamp) {
      const timestamp = this.formatTimestamp(entry.timestamp);
      parts.push(this.colorize(timestamp, Colors.gray));
    }

    // Level
    const level = this.formatLevel(entry.level);
    parts.push(level);

    // Message
    parts.push(entry.message);

    // Metadata
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      const metadata = this.formatMetadata(entry.metadata);
      parts.push(this.colorize(metadata, Colors.dim));
    }

    return parts.join(' ');
  }

  /**
   * Prepare entry for serialization
   */
  private prepareEntry(entry: LogEntry): Record<string, unknown> {
    const obj: Record<string, unknown> = {
      level: entry.level,
      message: entry.message,
    };

    if (this.options.includeTimestamp) {
      obj.timestamp = entry.timestamp;
    }

    if (entry.metadata) {
      // Flatten metadata into top level or keep nested
      obj.metadata = this.sanitizeMetadata(entry.metadata);
    }

    return obj;
  }

  /**
   * Sanitize metadata (handle errors, circular references, depth)
   */
  private sanitizeMetadata(
    metadata: LogMetadata,
    depth: number = 0
  ): Record<string, unknown> {
    if (depth >= this.options.maxDepth) {
      return { __truncated: true };
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (value instanceof Error) {
        sanitized[key] = {
          message: value.message,
          name: value.name,
          stack: value.stack,
        };
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? this.sanitizeMetadata(item as LogMetadata, depth + 1)
            : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value as LogMetadata, depth + 1);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Get JSON replacer function
   */
  private getReplacer(): (key: string, value: unknown) => unknown {
    const seen = new WeakSet();

    return (key: string, value: unknown) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }

      // Handle special types
      if (value instanceof Error) {
        return {
          message: value.message,
          name: value.name,
          stack: value.stack,
        };
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      return value;
    };
  }

  /**
   * Format timestamp for text output
   */
  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  /**
   * Format log level for text output
   */
  private formatLevel(level: LogLevel): string {
    const formatted = `[${level}]`.padEnd(7);
    return this.colorize(formatted, LevelColors[level]);
  }

  /**
   * Format metadata for text output
   */
  private formatMetadata(metadata: LogMetadata): string {
    const parts: string[] = [];

    // Common fields first
    if (metadata.component) {
      parts.push(`component=${metadata.component}`);
    }
    if (metadata.agentId) {
      parts.push(`agent=${metadata.agentId.slice(0, 8)}`);
    }
    if (metadata.taskId) {
      parts.push(`task=${metadata.taskId.slice(0, 8)}`);
    }
    if (metadata.duration !== undefined) {
      parts.push(`duration=${metadata.duration}ms`);
    }

    // Other fields
    for (const [key, value] of Object.entries(metadata)) {
      if (!['component', 'agentId', 'taskId', 'duration', 'error'].includes(key)) {
        parts.push(`${key}=${this.stringifyValue(value)}`);
      }
    }

    // Error last
    if (metadata.error instanceof Error) {
      parts.push(`error="${metadata.error.message}"`);
    }

    return parts.length > 0 ? `{${parts.join(', ')}}` : '';
  }

  /**
   * Stringify a value for text output
   */
  private stringifyValue(value: unknown): string {
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Apply color if colorize is enabled
   */
  private colorize(text: string, color: string): string {
    if (!this.options.colorize) {
      return text;
    }
    return `${color}${text}${Colors.reset}`;
  }

  /**
   * Update formatter options
   */
  setOptions(options: Partial<FormatOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): FormatOptions {
    return { ...this.options };
  }
}

/**
 * Create a formatter instance
 */
export function createFormatter(options?: Partial<FormatOptions>): LogFormatter {
  return new LogFormatter(options);
}

/**
 * Default formatters
 */
export const jsonFormatter = createFormatter({ format: 'json' });
export const prettyJsonFormatter = createFormatter({
  format: 'json',
  prettyPrint: true,
});
export const textFormatter = createFormatter({
  format: 'text',
  colorize: true,
});
