/**
 * Discovery Commands - Agent pool discovery and status queries
 * Implements User Story 1 (US1): Agent Discovery
 *
 * Commands:
 * - list agents: Display all connected agents in a table
 * - status: Display pool summary with counts
 * - status <agent-id>: Display detailed status for specific agent
 * - ping all: Ping all connected agents
 */

import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { SlackChannel } from '../../channels/slack/SlackChannel.js';
import { SlackFormatter } from '../formatters/SlackFormatter.js';
import { ResponseBuilder } from '../formatters/ResponseBuilder.js';
import { ErrorCode } from '../types.js';
import { AgentStatus } from '../../agents/Agent.js';

/**
 * List all connected agents
 */
export async function listAgents(
  _tokens: string[],
  _userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry
): Promise<void> {
  if (!registry) {
    const formatter = new SlackFormatter(channel);
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Agent registry not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  const agents = registry.getAll();
  const formatter = new SlackFormatter(channel);

  if (agents.length === 0) {
    await formatter.sendInfo('No agents currently connected to the pool.');
    return;
  }

  // Build table with agent details
  const headers = ['Agent ID', 'Role', 'Status', 'Platform', 'Environment', 'Current Task'];
  const rows = agents.map((agent) => [
    agent.id,
    agent.role,
    agent.status,
    agent.platform,
    agent.environment,
    agent.currentTask || '-',
  ]);

  await formatter.sendTable(headers, rows, `Connected Agents (${agents.length})`);
}

/**
 * Display pool status summary
 */
export async function poolStatus(
  _tokens: string[],
  _userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry
): Promise<void> {
  if (!registry) {
    const formatter = new SlackFormatter(channel);
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Agent registry not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  const stats = registry.getStats();
  const formatter = new SlackFormatter(channel);

  // Build status sections
  const sections: Record<string, string> = {
    'Total Agents': stats.total.toString(),
    'Active Agents': stats.active.toString(),
    'Connected': stats.connected.toString(),
    'Disconnected': stats.disconnected.toString(),
  };

  // Add role breakdown
  if (Object.keys(stats.byRole).length > 0) {
    sections['By Role'] = Object.entries(stats.byRole)
      .map(([role, count]) => `${role}: ${count}`)
      .join(', ');
  }

  await formatter.sendSections(sections, 'Agent Pool Status');
}

/**
 * Display detailed status for specific agent
 */
export async function agentStatus(
  tokens: string[],
  _userId: string,
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

  // Extract agent ID from tokens (second token)
  const agentId = tokens[1];
  if (!agentId) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: 'Agent ID required',
      suggestion: 'Usage: status <agent-id>',
    });
    return;
  }

  const agent = registry.getByIdCaseInsensitive(agentId);
  if (!agent) {
    await formatter.sendError({
      code: ErrorCode.AGENT_NOT_FOUND,
      message: `Agent '${agentId}' not found`,
      suggestion: 'Use "list agents" to see all connected agents',
    });
    return;
  }

  // Build detailed status sections
  const sections: Record<string, string> = {
    'Agent ID': agent.id,
    'Role': agent.role,
    'Status': agent.status,
    'Platform': agent.platform,
    'Environment': agent.environment,
    'Current Task': agent.currentTask || 'None',
    'Registered At': ResponseBuilder.formatRelativeTime(agent.registeredAt.toISOString()),
    'Last Seen': ResponseBuilder.formatRelativeTime(agent.lastSeenAt.toISOString()),
  };

  // Add capability information if available
  if (agent.capabilities) {
    const caps = agent.capabilities;
    if (caps.tools && caps.tools.length > 0) {
      sections['Tools'] = caps.tools.join(', ');
    }
    if (caps.languages && caps.languages.length > 0) {
      sections['Languages'] = caps.languages.join(', ');
    }
    if (caps.apiAccess && caps.apiAccess.length > 0) {
      sections['API Access'] = caps.apiAccess.join(', ');
    }
  }

  await formatter.sendSections(sections, `Agent Status: ${agentId}`);
}

/**
 * Ping all connected agents
 */
export async function pingAll(
  _tokens: string[],
  _userId: string,
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

  const agents = registry.getAll();

  if (agents.length === 0) {
    await formatter.sendInfo('No agents currently connected to ping.');
    return;
  }

  // For MVP, just acknowledge the ping command
  // Full implementation will broadcast ping to all agents via channel
  const connectedAgents = agents.filter((a) => a.status === AgentStatus.CONNECTED);

  await formatter.sendConfirmation(
    `Pinging ${connectedAgents.length} connected agent(s): ${connectedAgents
      .map((a) => a.id)
      .join(', ')}`
  );

  // TODO: Implement actual broadcast ping when messaging protocol is ready
  // This will use channel.sendProtocolMessage() to broadcast PING message type
}
