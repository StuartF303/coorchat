/**
 * System Commands - Help, version, restart, shutdown
 * Implements User Story 7 (US7): System Management
 *
 * Commands:
 * - help: Display all available commands with descriptions
 * - version: Show relay server and agent versions
 * - restart <agent-id>: Restart specific agent
 * - shutdown <agent-id>: Shutdown specific agent
 */

import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { SlackChannel } from '../../channels/slack/SlackChannel.js';
import type { TaskManager } from '../../tasks/TaskManager.js';
import type { CommandRegistry } from '../CommandRegistry.js';
import { SlackFormatter } from '../formatters/SlackFormatter.js';
import { ResponseBuilder } from '../formatters/ResponseBuilder.js';
import { ErrorCode } from '../types.js';

/**
 * Display help for all commands
 * Note: This requires access to CommandRegistry which is passed via context
 */
export async function help(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry,
  taskManager?: TaskManager,
  commandRegistry?: CommandRegistry
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  if (!commandRegistry) {
    // Fallback if registry not provided
    await formatter.sendConfirmation(
      'Available commands:\n' +
      'Discovery: list, status, ping\n' +
      'Communication: @<agent-id>, broadcast, ask\n' +
      'Queue: queue, tasks, cancel, assign, priority\n' +
      'Config: config, pause, resume\n' +
      'Monitoring: logs, metrics, errors, history\n' +
      'System: help, version, restart, shutdown'
    );
    return;
  }

  // Get all commands from registry
  const commands = commandRegistry.getAllCommands();
  const commandList: string[] = [];
  const seen = new Set<string>();

  for (const [name, def] of commands.entries()) {
    // Skip duplicates (aliases)
    const key = def.description;
    if (seen.has(key)) continue;
    seen.add(key);

    const examples = def.examples?.[0] || name;
    commandList.push(`• \`${examples}\` - ${def.description}`);
  }

  await formatter.sendConfirmation(
    '**Available Commands**\n\n' + commandList.join('\n')
  );
}

/**
 * Display version information
 */
export async function version(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry,
  taskManager?: TaskManager
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  const versionInfo: Record<string, string> = {
    'MCP Server': '1.0.0',
    'Relay Server': 'Unknown (query not implemented)',
    'Protocol Version': '1.0',
  };

  // Add agent versions if available
  if (registry) {
    const agents = registry.getAll();
    const agentCount = agents.length;
    versionInfo['Connected Agents'] = agentCount.toString();
  }

  await formatter.sendSections(versionInfo, 'Version Information');
}

/**
 * Restart specific agent
 */
export async function restart(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry,
  taskManager?: TaskManager
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

  // MVP: Acknowledge restart request
  // TODO: Send RESTART message via protocol when agent communication is implemented
  await formatter.sendConfirmation(
    `Restart request sent to ${agentId}\n(Agent will disconnect and reconnect when protocol messaging is implemented)`
  );
}

/**
 * Shutdown specific agent
 */
export async function shutdown(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry,
  taskManager?: TaskManager
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

  // MVP: Acknowledge shutdown request
  // TODO: Send SHUTDOWN message via protocol when agent communication is implemented
  await formatter.sendConfirmation(
    `Shutdown request sent to ${agentId}\n(Agent will gracefully disconnect when protocol messaging is implemented)`
  );
}
