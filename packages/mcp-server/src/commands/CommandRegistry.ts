/**
 * CommandRegistry
 * Central registry and dispatcher for all commands
 */

import type { CommandDef } from './types.js';
import type { SlackChannel} from '../channels/slack/SlackChannel.js';
import type { AgentRegistry } from '../agents/AgentRegistry.js';
import type { TaskManager } from '../tasks/TaskManager.js';
import { CommandParser } from './CommandParser.js';
import {
  listAgents,
  poolStatus,
  agentStatus,
  pingAll,
} from './handlers/DiscoveryCommands.js';
import {
  directMessage,
  broadcast,
  ask,
} from './handlers/CommunicationCommands.js';
import {
  queueView,
  allTasks,
  cancelTask,
} from './handlers/QueueCommands.js';
import {
  assignTask,
  updatePriority,
} from './handlers/AssignmentCommands.js';
import {
  config,
  pause,
  resume,
} from './handlers/ConfigCommands.js';
import {
  logs,
  metrics,
  errors,
  history,
} from './handlers/MonitoringCommands.js';
import {
  help,
  version,
  restart,
  shutdown,
} from './handlers/SystemCommands.js';
import {
  abortTask,
  runNext,
} from './handlers/ExecutionCommands.js';
import type { TaskWorker } from '../tasks/TaskWorker.js';

export class CommandRegistry {
  private commands: Map<string, CommandDef> = new Map();
  private parser: CommandParser;
  private channel: SlackChannel;
  private registry?: AgentRegistry;
  private taskManager?: TaskManager;
  private worker?: TaskWorker;

  constructor(channel: SlackChannel, registry?: AgentRegistry, taskManager?: TaskManager, worker?: TaskWorker) {
    this.channel = channel;
    this.registry = registry;
    this.taskManager = taskManager;
    this.worker = worker;
    this.parser = new CommandParser();

    // Register built-in commands
    this.registerBuiltinCommands();
  }

  /**
   * Set the task worker (can be set after construction)
   */
  setWorker(worker: TaskWorker): void {
    this.worker = worker;
  }

  /**
   * Register built-in discovery commands
   */
  private registerBuiltinCommands(): void {
    // US1: Agent Discovery Commands

    this.register('list', {
      minArgs: 1,
      maxArgs: 1,
      description: 'List all connected agents',
      examples: ['list agents'],
      execute: listAgents,
    });

    this.register('status', {
      minArgs: 0,
      maxArgs: 1,
      description: 'Display pool status or specific agent status',
      examples: ['status', 'status T14'],
      execute: async (tokens, userId, channel, registry) => {
        if (tokens.length === 1) {
          // Pool status
          await poolStatus(tokens, userId, channel, registry);
        } else {
          // Agent status
          await agentStatus(tokens, userId, channel, registry);
        }
      },
    });

    this.register('ping', {
      minArgs: 1,
      maxArgs: 1,
      description: 'Ping all connected agents',
      examples: ['ping all'],
      execute: pingAll,
    });

    // US2: Communication Commands

    this.register('direct-message', {
      minArgs: 1, // @agent-id counts as 1 arg (includes agent ID), message text is additional args
      description: 'Send direct message to specific agent',
      examples: ['@T14 what are you working on?', '@agent-001 status update?'],
      execute: directMessage,
    });

    this.register('broadcast', {
      minArgs: 1,
      description: 'Broadcast message to all connected agents',
      examples: ['broadcast All agents please report status'],
      execute: broadcast,
    });

    this.register('ask', {
      minArgs: 2,
      description: 'Ask question to specific agent',
      examples: ['ask T14 what is your current task?'],
      execute: ask,
    });

    // US3: Queue Inspection Commands

    this.register('queue', {
      minArgs: 1,
      maxArgs: 1,
      description: 'Display task queue for specific agent',
      examples: ['queue T14'],
      execute: queueView,
    });

    this.register('tasks', {
      minArgs: 0,
      maxArgs: 0,
      description: 'Display all tasks grouped by agent',
      examples: ['tasks'],
      execute: allTasks,
    });

    this.register('cancel', {
      minArgs: 1,
      maxArgs: 1,
      description: 'Cancel specific task by ID',
      examples: ['cancel task-123', 'cancel abc12def'],
      execute: cancelTask,
    });

    // US4: Task Assignment Commands

    this.register('assign', {
      minArgs: 2,
      description: 'Assign task to specific agent',
      examples: ['assign T14 fix login bug', 'assign agent-001 implement feature X'],
      execute: assignTask,
    });

    this.register('priority', {
      minArgs: 2,
      maxArgs: 2,
      description: 'Update task priority',
      examples: ['priority task-123 high', 'priority abc12def 1'],
      execute: updatePriority,
    });

    // US5: Agent Configuration Commands

    this.register('config', {
      minArgs: 2,
      description: 'Configure agent settings',
      examples: [
        'config T14 model opus',
        'config T14 role reviewer',
        'config T14 queue-limit 100',
        'config T14 show'
      ],
      execute: config,
    });

    this.register('pause', {
      minArgs: 1,
      maxArgs: 1,
      description: 'Pause agent (stop accepting tasks)',
      examples: ['pause T14'],
      execute: pause,
    });

    this.register('resume', {
      minArgs: 1,
      maxArgs: 1,
      description: 'Resume agent (start accepting tasks)',
      examples: ['resume T14'],
      execute: resume,
    });

    // US6: Monitoring and Debugging Commands

    this.register('logs', {
      minArgs: 1,
      maxArgs: 2,
      description: 'Retrieve agent logs',
      examples: ['logs T14', 'logs T14 10'],
      execute: logs,
    });

    this.register('metrics', {
      minArgs: 1,
      maxArgs: 1,
      description: 'Display agent metrics',
      examples: ['metrics T14'],
      execute: metrics,
    });

    this.register('errors', {
      minArgs: 0,
      maxArgs: 0,
      description: 'Show recent errors across all agents',
      examples: ['errors'],
      execute: errors,
    });

    this.register('history', {
      minArgs: 1,
      maxArgs: 1,
      description: 'Display task history for agent',
      examples: ['history T14'],
      execute: history,
    });

    // US7: System Management Commands

    this.register('help', {
      minArgs: 0,
      maxArgs: 0,
      description: 'Display all available commands',
      examples: ['help'],
      execute: help,
    });

    this.register('version', {
      minArgs: 0,
      maxArgs: 0,
      description: 'Show version information',
      examples: ['version'],
      execute: version,
    });

    this.register('restart', {
      minArgs: 1,
      maxArgs: 1,
      description: 'Restart specific agent',
      examples: ['restart T14'],
      execute: restart,
    });

    this.register('shutdown', {
      minArgs: 1,
      maxArgs: 1,
      description: 'Shutdown specific agent',
      examples: ['shutdown T14'],
      execute: shutdown,
    });

    // Task Execution Commands

    this.register('abort', {
      minArgs: 0,
      maxArgs: 0,
      description: 'Abort the currently running task',
      examples: ['abort'],
      execute: abortTask,
    });

    this.register('run', {
      minArgs: 1,
      maxArgs: 1,
      description: 'Manually trigger task processing',
      examples: ['run next'],
      execute: runNext,
    });
  }

  /**
   * Register a command
   * @param name Command name (lowercase)
   * @param definition Command definition with handler
   */
  register(name: string, definition: CommandDef): void {
    this.commands.set(name.toLowerCase(), definition);

    // Also register aliases
    if (definition.aliases) {
      for (const alias of definition.aliases) {
        this.commands.set(alias.toLowerCase(), definition);
      }
    }
  }

  /**
   * Handle incoming text message as command
   * @param text Raw text from Slack
   * @param userId User who sent the message
   */
  async handleCommand(text: string, userId: string): Promise<void> {
    try {
      // Sanitize input
      const sanitized = this.parser.sanitize(text);

      // Parse into tokens
      const tokens = this.parser.parse(sanitized);

      if (tokens.length === 0) {
        return; // Empty message, ignore
      }

      // Extract command name
      const commandName = this.parser.extractCommandName(tokens);

      // Log command execution (FR-042: Command logging)
      console.log('Command received', {
        userId,
        command: commandName,
        args: tokens.slice(1),
        timestamp: new Date().toISOString(),
        rawText: text.substring(0, 100), // First 100 chars
      });

      // Find command definition
      const commandDef = this.findCommand(commandName);

      if (!commandDef) {
        // Unknown command - suggest similar
        const suggestions = this.findSimilarCommands(commandName);
        const suggestionText = suggestions.length > 0
          ? ` Did you mean: ${suggestions.join(', ')}?`
          : '';

        await this.channel.sendText(
          `❌ Unknown command: \`${commandName}\`.${suggestionText} Try \`help\` for available commands.`
        );
        return;
      }

      // Validate argument count
      const argCount = tokens.length - 1;
      if (argCount < commandDef.minArgs) {
        const examples = commandDef.examples?.map(ex => `  • ${ex}`).join('\n') || '';
        await this.channel.sendText(
          `❌ Command \`${commandName}\` requires at least ${commandDef.minArgs} arguments.\n\n` +
          `Examples:\n${examples}`
        );
        return;
      }

      if (commandDef.maxArgs !== undefined && argCount > commandDef.maxArgs) {
        await this.channel.sendText(
          `❌ Command \`${commandName}\` accepts at most ${commandDef.maxArgs} arguments.`
        );
        return;
      }

      // Execute command
      await commandDef.execute(tokens, userId, this.channel, this.registry, this.taskManager, this, this.worker);

    } catch (error) {
      console.error('Command execution error:', error);
      await this.channel.sendText(
        `❌ Error executing command: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Find command by name or alias
   * @param name Command name (case-insensitive)
   * @returns Command definition or undefined
   */
  private findCommand(name: string): CommandDef | undefined {
    return this.commands.get(name.toLowerCase());
  }

  /**
   * Find similar command names (typo suggestions)
   * Uses simple Levenshtein distance
   * @param input User's input
   * @param maxDistance Maximum edit distance (default: 2)
   * @returns Array of similar command names
   */
  private findSimilarCommands(input: string, maxDistance: number = 2): string[] {
    const suggestions: string[] = [];
    const seenCommands = new Set<string>();

    for (const [name, def] of this.commands.entries()) {
      // Skip if we've already suggested this command (via alias)
      if (seenCommands.has(name)) {
        continue;
      }

      const distance = this.levenshteinDistance(input.toLowerCase(), name.toLowerCase());
      if (distance <= maxDistance) {
        suggestions.push(name);
        seenCommands.add(name);

        // Also mark aliases as seen
        if (def.aliases) {
          for (const alias of def.aliases) {
            seenCommands.add(alias.toLowerCase());
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param a First string
   * @param b Second string
   * @returns Edit distance
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Get all registered commands for help generation
   * @returns Map of command names to definitions
   */
  getAllCommands(): Map<string, CommandDef> {
    return new Map(this.commands);
  }
}
