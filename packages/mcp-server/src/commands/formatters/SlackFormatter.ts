/**
 * SlackFormatter
 * Formats command responses for Slack using Block Kit and markdown
 */

import type { SlackChannel } from '../../channels/slack/SlackChannel.js';

export class SlackFormatter {
  private channel: SlackChannel;

  constructor(channel: SlackChannel) {
    this.channel = channel;
  }

  /**
   * Send a success confirmation message
   * @param message Success message text
   */
  async sendConfirmation(message: string): Promise<void> {
    await this.channel.sendText(`✅ ${message}`);
  }

  /**
   * Send an error message
   * @param message Error message or error object
   */
  async sendError(message: string | { code: string; message: string; suggestion?: string }): Promise<void> {
    if (typeof message === 'string') {
      await this.channel.sendText(`❌ Error: ${message}`);
    } else {
      const suggestionText = message.suggestion ? `\n\n💡 ${message.suggestion}` : '';
      await this.channel.sendText(
        `❌ Error: ${message.message}${suggestionText}\n\n_Code: ${message.code}_`
      );
    }
  }

  /**
   * Send a warning message
   * @param message Warning text
   */
  async sendWarning(message: string): Promise<void> {
    await this.channel.sendText(`⚠️ ${message}`);
  }

  /**
   * Send an info message
   * @param message Info text
   */
  async sendInfo(message: string): Promise<void> {
    await this.channel.sendText(`ℹ️ ${message}`);
  }

  /**
   * Send a table using monospace code block with aligned columns
   * @param headers Column headers
   * @param rows Data rows (each row is an array of strings)
   * @param title Optional table title
   */
  async sendTable(headers: string[], rows: string[][], title?: string): Promise<void> {
    // Calculate column widths (minimum 3 chars, add padding)
    const columnWidths = headers.map((header, i) => {
      const maxDataWidth = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
      return Math.max(header.length, maxDataWidth) + 2; // Add 2 for padding
    });

    // Helper to pad a cell
    const padCell = (text: string, width: number): string => {
      return text.padEnd(width, ' ');
    };

    // Build table in code block for monospace alignment
    let table = '';

    if (title) {
      table += `*${title}*\n\n`;
    }

    table += '```\n';

    // Header row
    const headerRow = headers.map((h, i) => padCell(h, columnWidths[i])).join(' ');
    table += headerRow + '\n';

    // Separator row
    const separator = columnWidths.map(w => '─'.repeat(w)).join(' ');
    table += separator + '\n';

    // Data rows
    for (const row of rows) {
      const dataRow = row.map((cell, i) => padCell(cell, columnWidths[i])).join(' ');
      table += dataRow + '\n';
    }

    table += '```';

    await this.channel.sendText(table);
  }

  /**
   * Send sections using Block Kit Section blocks
   * @param sections Key-value pairs to display
   * @param title Optional section title
   */
  async sendSections(sections: Record<string, string>, title?: string): Promise<void> {
    let message = title ? `**${title}**\n\n` : '';

    for (const [key, value] of Object.entries(sections)) {
      message += `*${key}*: ${value}\n`;
    }

    await this.channel.sendText(message);
  }

  /**
   * Send a code block
   * @param code Code content
   * @param language Optional language for syntax highlighting
   */
  async sendCodeBlock(code: string, language?: string): Promise<void> {
    const lang = language || '';
    await this.channel.sendText(`\`\`\`${lang}\n${code}\n\`\`\``);
  }

  /**
   * Send a list (bulleted)
   * @param items List items
   * @param title Optional list title
   */
  async sendList(items: string[], title?: string): Promise<void> {
    let message = title ? `**${title}**\n\n` : '';
    message += items.map(item => `• ${item}`).join('\n');
    await this.channel.sendText(message);
  }

  /**
   * Truncate message if it exceeds Slack's 40,000 character limit
   * @param message Message to truncate
   * @param maxLength Maximum length (default: 39,000 to leave room for truncation indicator)
   * @returns Truncated message with indicator if needed
   */
  truncate(message: string, maxLength: number = 39000): string {
    if (message.length <= maxLength) {
      return message;
    }

    const truncated = message.substring(0, maxLength);
    return `${truncated}\n\n_[Message truncated - ${message.length - maxLength} characters omitted]_`;
  }
}
