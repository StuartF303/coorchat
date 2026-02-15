/**
 * Logger - Structured logging interface with multiple levels
 * Based on specs/001-multi-agent-coordination/plan.md logging requirements
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

/**
 * Log level numeric values for comparison
 */
export const LogLevelValue: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 40,
  [LogLevel.WARN]: 30,
  [LogLevel.INFO]: 20,
  [LogLevel.DEBUG]: 10,
};

/**
 * Log entry metadata
 */
export interface LogMetadata {
  /** Component or module name */
  component?: string;

  /** Agent ID if applicable */
  agentId?: string;

  /** Task ID if applicable */
  taskId?: string;

  /** Request correlation ID */
  correlationId?: string;

  /** Error object */
  error?: Error;

  /** Duration in milliseconds */
  duration?: number;

  /** Custom key-value pairs */
  [key: string]: unknown;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;

  /** Log message */
  message: string;

  /** Timestamp (ISO 8601) */
  timestamp: string;

  /** Additional metadata */
  metadata?: LogMetadata;
}

/**
 * Logger interface
 */
export interface Logger {
  /**
   * Get current log level
   */
  readonly level: LogLevel;

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void;

  /**
   * Log an error message
   */
  error(message: string, metadata?: LogMetadata): void;

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: LogMetadata): void;

  /**
   * Log an info message
   */
  info(message: string, metadata?: LogMetadata): void;

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: LogMetadata): void;

  /**
   * Log at a specific level
   */
  log(level: LogLevel, message: string, metadata?: LogMetadata): void;

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean;

  /**
   * Create a child logger with preset metadata
   */
  child(metadata: LogMetadata): Logger;
}

/**
 * Base logger implementation
 */
export abstract class BaseLogger implements Logger {
  protected _level: LogLevel;
  protected childMetadata?: LogMetadata;

  constructor(level: LogLevel = LogLevel.INFO, childMetadata?: LogMetadata) {
    this._level = level;
    this.childMetadata = childMetadata;
  }

  get level(): LogLevel {
    return this._level;
  }

  setLevel(level: LogLevel): void {
    this._level = level;
  }

  error(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata: this.mergeMetadata(metadata),
    };

    this.write(entry);
  }

  isLevelEnabled(level: LogLevel): boolean {
    return LogLevelValue[level] >= LogLevelValue[this._level];
  }

  child(metadata: LogMetadata): Logger {
    const childMeta = this.mergeMetadata(metadata);
    return new (this.constructor as new (
      level: LogLevel,
      childMetadata?: LogMetadata
    ) => BaseLogger)(this._level, childMeta);
  }

  /**
   * Merge child metadata with provided metadata
   */
  protected mergeMetadata(metadata?: LogMetadata): LogMetadata | undefined {
    if (!this.childMetadata && !metadata) {
      return undefined;
    }

    return {
      ...this.childMetadata,
      ...metadata,
    };
  }

  /**
   * Abstract method to write log entry (implemented by subclasses)
   */
  protected abstract write(entry: LogEntry): void;
}

/**
 * Console logger implementation
 */
export class ConsoleLogger extends BaseLogger {
  protected write(entry: LogEntry): void {
    const method = this.getConsoleMethod(entry.level);
    method(this.format(entry));
  }

  /**
   * Get appropriate console method for log level
   */
  private getConsoleMethod(
    level: LogLevel
  ): (...args: unknown[]) => void {
    switch (level) {
      case LogLevel.ERROR:
        return console.error.bind(console);
      case LogLevel.WARN:
        return console.warn.bind(console);
      case LogLevel.INFO:
        return console.info.bind(console);
      case LogLevel.DEBUG:
        return console.debug.bind(console);
      default:
        return console.log.bind(console);
    }
  }

  /**
   * Format log entry (can be overridden)
   */
  protected format(entry: LogEntry): string {
    return JSON.stringify(entry);
  }
}

/**
 * No-op logger (discards all logs)
 */
export class NoopLogger extends BaseLogger {
  protected write(_entry: LogEntry): void {
    // No-op
  }
}

/**
 * Create a logger instance
 */
export function createLogger(
  level: LogLevel = LogLevel.INFO,
  type: 'console' | 'noop' = 'console'
): Logger {
  switch (type) {
    case 'console':
      return new ConsoleLogger(level);
    case 'noop':
      return new NoopLogger(level);
    default:
      return new ConsoleLogger(level);
  }
}

/**
 * Default logger instance
 */
export const logger = createLogger();
