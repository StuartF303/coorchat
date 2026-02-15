/**
 * CommandHandler - Processes plain text commands from channel users
 */

export interface AgentInfo {
  id: string;
  role: string;
  channelType: string;
}

export type SendFn = (text: string) => Promise<void>;

export class CommandHandler {
  private agentInfo: AgentInfo;
  private send: SendFn;
  private startTime: number;

  constructor(agentInfo: AgentInfo, send: SendFn) {
    this.agentInfo = agentInfo;
    this.send = send;
    this.startTime = Date.now();
  }

  async handle(text: string, _userId: string): Promise<void> {
    const command = text.toLowerCase().trim();

    switch (command) {
      case 'help':
        return this.cmdHelp();
      case 'ping':
        return this.cmdPing();
      case 'status':
        return this.cmdStatus();
      case 'whoami':
        return this.cmdWhoami();
      default:
        return this.send(`Unknown command: \`${text}\`. Try \`help\` for available commands.`);
    }
  }

  private async cmdHelp(): Promise<void> {
    const lines = [
      '*Available Commands:*',
      '`help` — List available commands',
      '`ping` — Check if agent is responsive',
      '`status` — Show agent status and uptime',
      '`whoami` — Show agent identity and role',
    ];
    return this.send(lines.join('\n'));
  }

  private async cmdPing(): Promise<void> {
    return this.send('pong');
  }

  private async cmdStatus(): Promise<void> {
    const uptimeMs = Date.now() - this.startTime;
    const uptime = this.formatUptime(uptimeMs);
    const lines = [
      '*Agent Status:*',
      `ID: \`${this.agentInfo.id}\``,
      `Role: ${this.agentInfo.role}`,
      `Channel: ${this.agentInfo.channelType}`,
      `Uptime: ${uptime}`,
    ];
    return this.send(lines.join('\n'));
  }

  private async cmdWhoami(): Promise<void> {
    return this.send(`I am \`${this.agentInfo.id}\` with role *${this.agentInfo.role}* on ${this.agentInfo.channelType}.`);
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}
