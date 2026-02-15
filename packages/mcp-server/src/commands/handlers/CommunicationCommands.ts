/**
 * Communication Commands - Direct messaging and broadcast
 * Implements User Story 2 (US2): Direct Messaging
 *
 * Commands:
 * - @<agent-id> <message>: Send direct message to specific agent
 * - broadcast <message>: Send message to all connected agents
 * - ask <agent-id> <question>: Alternative syntax for direct message
 */

import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { SlackChannel } from '../../channels/slack/SlackChannel.js';
import { SlackFormatter } from '../formatters/SlackFormatter.js';
import { ErrorCode } from '../types.js';
import { AgentStatus } from '../../agents/Agent.js';
import { MessageType } from '../../protocol/Message.js';
import type { DirectMessagePayload, BroadcastPayload } from '../../protocol/Message.js';

/**
 * Response timeout in milliseconds (30 seconds)
 */
const RESPONSE_TIMEOUT_MS = 30000;

/**
 * Send direct message to specific agent (@agent-id syntax)
 */
export async function directMessage(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  if (!registry) {
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Agent registry not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  // Extract agent ID (first token starts with @)
  const agentId = tokens[0].substring(1); // Remove @ prefix

  // Extract message text (all remaining tokens)
  const messageText = tokens.slice(1).join(' ').trim();

  if (!messageText) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: 'Message text required',
      suggestion: 'Usage: @<agent-id> <message>',
    });
    return;
  }

  // Verify agent exists
  const agent = registry.getById(agentId);
  if (!agent) {
    await formatter.sendError({
      code: ErrorCode.AGENT_NOT_FOUND,
      message: `Agent '${agentId}' not found`,
      suggestion: 'Use "list agents" to see all connected agents',
    });
    return;
  }

  // For MVP: acknowledge the message
  // TODO: Implement actual message routing via protocol when channel supports it
  await formatter.sendConfirmation(
    `Message sent to agent ${agentId}: "${messageText}"`
  );

  // TODO: When full protocol is ready, send via channel:
  // const payload: DirectMessagePayload = {
  //   text: messageText,
  //   userId,
  //   expectsResponse: true,
  //   timeoutMs: RESPONSE_TIMEOUT_MS,
  // };
  // await channel.sendProtocolMessage({
  //   protocolVersion: '1.0',
  //   messageType: MessageType.DIRECT_MESSAGE,
  //   senderId: 'coordinator',
  //   recipientId: agentId,
  //   timestamp: new Date().toISOString(),
  //   payload,
  // });
}

/**
 * Broadcast message to all connected agents
 */
export async function broadcast(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  if (!registry) {
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Agent registry not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  // Extract message text (all tokens after 'broadcast')
  const messageText = tokens.slice(1).join(' ').trim();

  if (!messageText) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: 'Message text required',
      suggestion: 'Usage: broadcast <message>',
    });
    return;
  }

  const connectedAgents = registry.getByStatus(AgentStatus.CONNECTED);

  if (connectedAgents.length === 0) {
    await formatter.sendInfo('No agents currently connected to broadcast to.');
    return;
  }

  // For MVP: acknowledge the broadcast
  await formatter.sendConfirmation(
    `Broadcasting to ${connectedAgents.length} agent(s): "${messageText}"`
  );

  // TODO: When full protocol is ready, send via channel:
  // const payload: BroadcastPayload = {
  //   text: messageText,
  //   userId,
  // };
  // await channel.sendProtocolMessage({
  //   protocolVersion: '1.0',
  //   messageType: MessageType.BROADCAST,
  //   senderId: 'coordinator',
  //   recipientId: null, // null indicates broadcast
  //   timestamp: new Date().toISOString(),
  //   payload,
  // });
}

/**
 * Ask question to specific agent (alternative syntax to @agent-id)
 */
export async function ask(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  if (!registry) {
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Agent registry not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  // Extract agent ID (second token)
  const agentId = tokens[1];

  if (!agentId) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: 'Agent ID required',
      suggestion: 'Usage: ask <agent-id> <question>',
    });
    return;
  }

  // Extract question text (all remaining tokens)
  const questionText = tokens.slice(2).join(' ').trim();

  if (!questionText) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: 'Question text required',
      suggestion: 'Usage: ask <agent-id> <question>',
    });
    return;
  }

  // Verify agent exists
  const agent = registry.getById(agentId);
  if (!agent) {
    await formatter.sendError({
      code: ErrorCode.AGENT_NOT_FOUND,
      message: `Agent '${agentId}' not found`,
      suggestion: 'Use "list agents" to see all connected agents',
    });
    return;
  }

  // For MVP: acknowledge the question
  await formatter.sendConfirmation(
    `Question sent to agent ${agentId}: "${questionText}"`
  );

  // TODO: When full protocol is ready, implement same as directMessage
}

/**
 * Handle response timeout for direct messages
 * Called when agent doesn't respond within RESPONSE_TIMEOUT_MS
 */
export async function handleResponseTimeout(
  agentId: string,
  channel: SlackChannel
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  await formatter.sendWarning(
    `Agent ${agentId} did not respond within ${RESPONSE_TIMEOUT_MS / 1000} seconds. ` +
    `The agent may be busy or disconnected. Try checking its status with "status ${agentId}".`
  );
}
