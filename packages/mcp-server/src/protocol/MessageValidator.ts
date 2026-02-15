/**
 * MessageValidator - JSON Schema-based validation for CoorChat messages
 */

import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { Message, MessageType } from './Message.js';

/**
 * Message protocol JSON schema
 * Based on specs/001-multi-agent-coordination/contracts/message-protocol.json
 */
const messageSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://coorchat.dev/schemas/message-protocol/v1.0.json',
  title: 'CoorChat Message Protocol',
  description: 'JSON Schema for Multi-Agent Coordination System message format',
  type: 'object',
  required: ['protocolVersion', 'messageType', 'senderId', 'timestamp'],
  properties: {
    protocolVersion: {
      type: 'string',
      pattern: '^\\d+\\.\\d+$',
      description: "Semantic version of the protocol (e.g., '1.0')",
    },
    messageType: {
      type: 'string',
      enum: [
        'task_assigned',
        'task_started',
        'task_blocked',
        'task_progress',
        'task_completed',
        'task_failed',
        'capability_query',
        'capability_response',
        'status_query',
        'status_response',
        'error',
        'heartbeat',
        'agent_joined',
        'agent_left',
      ],
      description: 'Type of message being sent',
    },
    senderId: {
      type: 'string',
      format: 'uuid',
      description: 'UUID of the sending agent',
    },
    recipientId: {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'UUID of the recipient agent (null for broadcast)',
    },
    taskId: {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'UUID of the associated task (if applicable)',
    },
    priority: {
      type: 'integer',
      minimum: 0,
      maximum: 10,
      default: 5,
      description: 'Message priority (0=lowest, 10=highest)',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 timestamp when message was created',
    },
    correlationId: {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'UUID for matching request/response pairs',
    },
    payload: {
      type: 'object',
      description: 'Message-specific data (varies by messageType)',
    },
    deliveryStatus: {
      type: 'string',
      enum: ['queued', 'sending', 'sent', 'delivered', 'acknowledged', 'failed'],
      default: 'queued',
      description: 'Current delivery state of the message',
    },
  },
};

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

/**
 * MessageValidator class for validating protocol compliance
 */
export class MessageValidator {
  private ajv: Ajv;
  private validateMessage: ValidateFunction;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: true,
    });

    // Add format validators (uuid, date-time, uri, etc.)
    addFormats(this.ajv);

    // Compile the message schema
    this.validateMessage = this.ajv.compile(messageSchema);
  }

  /**
   * Validate a message against the protocol schema
   */
  validate(message: unknown): ValidationResult {
    const valid = this.validateMessage(message);

    if (valid) {
      return { valid: true };
    }

    const errors: ValidationError[] = (this.validateMessage.errors || []).map(
      (err) => ({
        field: err.instancePath || err.params?.missingProperty || 'unknown',
        message: err.message || 'Validation failed',
        value: err.data,
      })
    );

    return { valid: false, errors };
  }

  /**
   * Validate and throw on error
   * @throws Error if validation fails
   */
  validateOrThrow(message: unknown): asserts message is Message {
    const result = this.validate(message);

    if (!result.valid) {
      const errorDetails = result.errors!
        .map((err) => `${err.field}: ${err.message}`)
        .join(', ');
      throw new Error(`Message validation failed: ${errorDetails}`);
    }
  }

  /**
   * Check if message type requires a taskId
   */
  static requiresTaskId(messageType: MessageType): boolean {
    return [
      MessageType.TASK_ASSIGNED,
      MessageType.TASK_STARTED,
      MessageType.TASK_BLOCKED,
      MessageType.TASK_PROGRESS,
      MessageType.TASK_COMPLETED,
      MessageType.TASK_FAILED,
    ].includes(messageType);
  }

  /**
   * Check if message type requires a correlationId
   */
  static requiresCorrelationId(messageType: MessageType): boolean {
    return [
      MessageType.CAPABILITY_RESPONSE,
      MessageType.STATUS_RESPONSE,
    ].includes(messageType);
  }

  /**
   * Validate message type-specific requirements
   */
  validateSemantics(message: Message): ValidationResult {
    const errors: ValidationError[] = [];

    // Check taskId requirement
    if (MessageValidator.requiresTaskId(message.messageType) && !message.taskId) {
      errors.push({
        field: 'taskId',
        message: `Message type ${message.messageType} requires a taskId`,
      });
    }

    // Check correlationId requirement
    if (
      MessageValidator.requiresCorrelationId(message.messageType) &&
      !message.correlationId
    ) {
      errors.push({
        field: 'correlationId',
        message: `Message type ${message.messageType} requires a correlationId`,
      });
    }

    // Check priority range
    if (message.priority !== undefined && (message.priority < 0 || message.priority > 10)) {
      errors.push({
        field: 'priority',
        message: 'Priority must be between 0 and 10',
        value: message.priority,
      });
    }

    // Validate protocol version format
    if (!/^\d+\.\d+$/.test(message.protocolVersion)) {
      errors.push({
        field: 'protocolVersion',
        message: 'Protocol version must be in format "major.minor" (e.g., "1.0")',
        value: message.protocolVersion,
      });
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true };
  }

  /**
   * Perform full validation (schema + semantics)
   */
  validateFull(message: unknown): ValidationResult {
    // First, validate against JSON schema
    const schemaResult = this.validate(message);
    if (!schemaResult.valid) {
      return schemaResult;
    }

    // Then validate semantic rules
    return this.validateSemantics(message as Message);
  }

  /**
   * Get validation error summary
   */
  getErrorSummary(result: ValidationResult): string {
    if (result.valid) {
      return 'Valid';
    }

    return (
      result.errors?.map((err) => `${err.field}: ${err.message}`).join('; ') ||
      'Unknown validation error'
    );
  }
}

/**
 * Singleton validator instance
 */
export const validator = new MessageValidator();
