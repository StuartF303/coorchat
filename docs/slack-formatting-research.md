# Slack Message Formatting Best Practices for Rich Command Responses

**Context**: Displaying agent lists, status tables, error messages, and help documentation in Slack using TypeScript/@slack/web-api.

**Date**: 2026-02-15

## Executive Summary

**Recommended Approach**: **Hybrid** - Use Block Kit Table for structured data, mrkdwn for simple messages.

- **Best for agent status tables**: Block Kit Table Block (introduced August 2025)
- **Best for simple messages**: mrkdwn (Slack's markdown variant)
- **Best overall**: Hybrid approach combining both based on message complexity

---

## 1. Block Kit Table Block (Recommended for Agent Lists)

### Overview
- **Introduced**: August 2025
- **Character Limit**: Inherits from attachment blocks (12,000 chars recommended)
- **Mobile Experience**: Excellent - native table rendering with horizontal scrolling
- **Implementation Complexity**: Moderate - structured JSON, good TypeScript support

### Strengths
- Native table rendering with proper alignment
- Supports rich text (bold, links, emoji, mentions)
- Column settings for alignment and text wrapping
- Best mobile experience for tabular data
- Proper semantic structure

### Limitations
- Maximum 100 rows, 20 columns per table
- Only one table per message
- Requires attachment blocks (appended to bottom of message)
- More verbose JSON structure

### Code Example: Agent Status Table

```typescript
import { WebClient } from '@slack/web-api';

interface Agent {
  id: string;
  role: string;
  status: 'connected' | 'disconnected' | 'busy';
  model: string;
  lastSeen?: Date;
}

async function sendAgentStatusTable(
  client: WebClient,
  channelId: string,
  agents: Agent[]
): Promise<void> {
  // Build table rows (header + data)
  const rows = [
    // Header row
    [
      { type: 'raw_text', text: 'Agent ID' },
      { type: 'raw_text', text: 'Role' },
      { type: 'raw_text', text: 'Status' },
      { type: 'raw_text', text: 'Model' },
      { type: 'raw_text', text: 'Last Seen' }
    ],
    // Data rows with rich formatting
    ...agents.map(agent => [
      // ID column (raw text)
      { type: 'raw_text', text: agent.id },

      // Role column (bold text using rich_text)
      {
        type: 'rich_text',
        elements: [{
          type: 'rich_text_section',
          elements: [{
            type: 'text',
            text: agent.role,
            style: { bold: true }
          }]
        }]
      },

      // Status column with emoji
      {
        type: 'rich_text',
        elements: [{
          type: 'rich_text_section',
          elements: [
            {
              type: 'emoji',
              name: agent.status === 'connected' ? 'green_circle' :
                    agent.status === 'busy' ? 'yellow_circle' :
                    'red_circle'
            },
            {
              type: 'text',
              text: ` ${agent.status}`
            }
          ]
        }]
      },

      // Model column (raw text)
      { type: 'raw_text', text: agent.model },

      // Last seen column (formatted date)
      {
        type: 'raw_text',
        text: agent.lastSeen
          ? new Date(agent.lastSeen).toLocaleString()
          : 'Never'
      }
    ])
  ];

  // Character limit check (estimate: ~100 chars per row)
  const estimatedSize = rows.length * 100 * 5; // rows * ~100 chars * 5 columns
  if (estimatedSize > 12000) {
    // Paginate or warn
    console.warn(`Table may exceed limits: ~${estimatedSize} chars`);
  }

  await client.chat.postMessage({
    channel: channelId,
    text: 'Agent Status Report', // Fallback text
    attachments: [{
      blocks: [{
        type: 'table',
        column_settings: [
          { is_wrapped: false }, // ID column - no wrap
          { is_wrapped: true },  // Role column - wrap long text
          { align: 'center' },   // Status column - center aligned
          { is_wrapped: true },  // Model column - wrap
          { align: 'right' }     // Last seen column - right aligned
        ],
        rows
      }]
    }]
  });
}

// Usage example
const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const agents: Agent[] = [
  { id: 'agent-001', role: 'coordinator', status: 'connected', model: 'claude-opus-4-6' },
  { id: 'agent-002', role: 'worker', status: 'busy', model: 'claude-sonnet-4-5', lastSeen: new Date() },
  { id: 'agent-003', role: 'monitor', status: 'disconnected', model: 'claude-haiku-4' }
];

await sendAgentStatusTable(client, 'C1234567890', agents);
```

### Character Limit Handling

```typescript
function paginateAgents(agents: Agent[], pageSize: number = 90): Agent[][] {
  // Reserve 10 rows for header + context
  const pages: Agent[][] = [];

  for (let i = 0; i < agents.length; i += pageSize) {
    pages.push(agents.slice(i, i + pageSize));
  }

  return pages;
}

async function sendPaginatedAgentTable(
  client: WebClient,
  channelId: string,
  agents: Agent[]
): Promise<void> {
  const pages = paginateAgents(agents);

  for (let i = 0; i < pages.length; i++) {
    await sendAgentStatusTable(client, channelId, pages[i]);

    if (i < pages.length - 1) {
      // Send continuation message
      await client.chat.postMessage({
        channel: channelId,
        text: `_Showing ${i * 90 + 1}-${(i + 1) * 90} of ${agents.length} agents..._`
      });
    }
  }
}
```

---

## 2. Markdown (mrkdwn) - Simple Text Formatting

### Overview
- **Character Limit**: 40,000 chars (hard limit), 4,000 recommended
- **Mobile Experience**: Good - text wraps naturally, but no table structure
- **Implementation Complexity**: Low - simple string formatting

### Strengths
- Very simple to implement
- Lightweight and fast
- Works well for simple lists and messages
- Good for error messages and help text
- Supports Slack-specific features (@mentions, #channels, :emoji:)

### Limitations
- No semantic table structure
- Poor alignment for columnar data on mobile
- Limited visual hierarchy
- Must manually format spacing/alignment

### Code Example: Agent Status with mrkdwn

```typescript
async function sendAgentStatusMarkdown(
  client: WebClient,
  channelId: string,
  agents: Agent[]
): Promise<void> {
  // Build markdown text
  let text = '*Agent Status Report*\n\n';

  agents.forEach(agent => {
    const statusEmoji = agent.status === 'connected' ? ':green_circle:' :
                       agent.status === 'busy' ? ':yellow_circle:' :
                       ':red_circle:';

    text += `${statusEmoji} *${agent.id}* | ${agent.role}\n`;
    text += `  Model: \`${agent.model}\`\n`;
    if (agent.lastSeen) {
      text += `  Last seen: ${new Date(agent.lastSeen).toLocaleString()}\n`;
    }
    text += '\n';
  });

  // Character limit check
  if (text.length > 4000) {
    console.warn(`Message length: ${text.length} (recommended max: 4000)`);
  }

  if (text.length > 40000) {
    throw new Error(`Message too long: ${text.length} chars (max 40000)`);
  }

  await client.chat.postMessage({
    channel: channelId,
    text,
    mrkdwn: true
  });
}

// For simple lists
async function sendAgentListSimple(
  client: WebClient,
  channelId: string,
  agents: Agent[]
): Promise<void> {
  const text = [
    '*Connected Agents:*',
    ...agents.map(a => `• \`${a.id}\` - ${a.role} (${a.model})`),
    '',
    `_Total: ${agents.length} agents_`
  ].join('\n');

  await client.chat.postMessage({
    channel: channelId,
    text,
    mrkdwn: true
  });
}
```

### Character Limit Handling (mrkdwn)

```typescript
function truncateMarkdownMessage(text: string, maxLength: number = 4000): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Truncate with ellipsis, preserving complete lines
  const truncated = text.substring(0, maxLength - 50);
  const lastNewline = truncated.lastIndexOf('\n');

  return truncated.substring(0, lastNewline) + '\n\n_...message truncated_';
}

async function sendLongMarkdownMessage(
  client: WebClient,
  channelId: string,
  text: string
): Promise<void> {
  if (text.length <= 4000) {
    await client.chat.postMessage({
      channel: channelId,
      text,
      mrkdwn: true
    });
    return;
  }

  // Split into chunks
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const chunk = remaining.substring(0, 3900); // Leave buffer
    const lastNewline = chunk.lastIndexOf('\n');
    const cutPoint = lastNewline > 0 ? lastNewline : 3900;

    chunks.push(remaining.substring(0, cutPoint));
    remaining = remaining.substring(cutPoint + 1);
  }

  // Send chunks sequentially
  for (let i = 0; i < chunks.length; i++) {
    let chunkText = chunks[i];
    if (i > 0) {
      chunkText = `_Continued (${i + 1}/${chunks.length})..._\n\n` + chunkText;
    }

    await client.chat.postMessage({
      channel: channelId,
      text: chunkText,
      mrkdwn: true
    });
  }
}
```

---

## 3. Block Kit Sections (Structured Layouts without Tables)

### Overview
- **Character Limit**: 3,000 chars per text block
- **Mobile Experience**: Excellent - responsive layout
- **Implementation Complexity**: Moderate - structured but flexible

### Strengths
- Rich visual layouts with headers, dividers, context
- Two-column field layout for key-value pairs
- Good mobile experience with automatic stacking
- Supports interactive elements (buttons, menus)
- Better visual hierarchy than plain markdown

### Limitations
- Not ideal for large tables (no native table structure)
- More verbose than markdown
- Character limits per block (3,000 chars)

### Code Example: Agent Status with Section Blocks

```typescript
async function sendAgentStatusBlocks(
  client: WebClient,
  channelId: string,
  agents: Agent[]
): Promise<void> {
  const blocks = [
    // Header
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Agent Status Report'
      }
    },
    {
      type: 'divider'
    }
  ];

  // Add agent sections
  agents.forEach(agent => {
    const statusEmoji = agent.status === 'connected' ? ':green_circle:' :
                       agent.status === 'busy' ? ':yellow_circle:' :
                       ':red_circle:';

    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Agent ID:*\n\`${agent.id}\``
        },
        {
          type: 'mrkdwn',
          text: `*Role:*\n${agent.role}`
        },
        {
          type: 'mrkdwn',
          text: `*Status:*\n${statusEmoji} ${agent.status}`
        },
        {
          type: 'mrkdwn',
          text: `*Model:*\n\`${agent.model}\``
        }
      ]
    });

    // Add context with last seen time
    if (agent.lastSeen) {
      blocks.push({
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `Last seen: ${new Date(agent.lastSeen).toLocaleString()}`
        }]
      });
    }

    blocks.push({ type: 'divider' });
  });

  // Footer context
  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `Total agents: ${agents.length} | Updated: ${new Date().toLocaleString()}`
    }]
  });

  // Slack has a 50 block limit per message
  if (blocks.length > 50) {
    console.warn(`Too many blocks: ${blocks.length} (max 50)`);
  }

  await client.chat.postMessage({
    channel: channelId,
    text: 'Agent Status Report', // Fallback
    blocks
  });
}
```

### Error Message Example (Block Kit)

```typescript
async function sendErrorMessage(
  client: WebClient,
  channelId: string,
  error: { code: string; message: string; details?: string }
): Promise<void> {
  await client.chat.postMessage({
    channel: channelId,
    text: `Error: ${error.message}`, // Fallback
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:x: *Error ${error.code}*`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: error.message
        }
      },
      ...(error.details ? [{
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `\`\`\`${error.details}\`\`\``
        }]
      }] : [])
    ]
  });
}
```

### Help Documentation Example (Block Kit)

```typescript
async function sendHelpMessage(
  client: WebClient,
  channelId: string
): Promise<void> {
  await client.chat.postMessage({
    channel: channelId,
    text: 'Agent Commands Help',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':information_source: Agent Commands'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Available Commands:*'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: '*`/status`*\nShow all agent status'
          },
          {
            type: 'mrkdwn',
            text: '*`/ping <agent-id>`*\nPing specific agent'
          },
          {
            type: 'mrkdwn',
            text: '*`/list`*\nList connected agents'
          },
          {
            type: 'mrkdwn',
            text: '*`/help`*\nShow this help message'
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: 'For more information, visit our documentation at <https://example.com/docs|docs>'
        }]
      }
    ]
  });
}
```

---

## 4. Hybrid Approach (RECOMMENDED)

### Decision Matrix

| Use Case | Recommended Approach | Rationale |
|----------|---------------------|-----------|
| Agent status table (10+ agents) | **Block Kit Table** | Native table rendering, best mobile UX, proper alignment |
| Agent status (1-5 agents) | **Block Kit Sections** | Good visual hierarchy, flexible layout |
| Simple agent list | **mrkdwn** | Fastest implementation, sufficient for lists |
| Error messages | **Block Kit Sections** | Visual emphasis with context |
| Help documentation | **Block Kit Sections** | Rich formatting, good structure |
| Long text responses | **mrkdwn** (chunked) | Simple, handles text well |

### Unified Implementation

```typescript
import { WebClient, Block } from '@slack/web-api';

class SlackMessageFormatter {
  constructor(private client: WebClient, private channelId: string) {}

  /**
   * Send agent status - automatically chooses best format
   */
  async sendAgentStatus(agents: Agent[]): Promise<void> {
    if (agents.length > 5) {
      // Use table for larger lists
      await this.sendAgentTable(agents);
    } else {
      // Use sections for smaller lists
      await this.sendAgentSections(agents);
    }
  }

  /**
   * Table format (10+ agents)
   */
  private async sendAgentTable(agents: Agent[]): Promise<void> {
    // Paginate if needed (max 90 agents per table)
    const pages = this.paginateAgents(agents, 90);

    for (const pageAgents of pages) {
      const rows = [
        // Header
        [
          { type: 'raw_text', text: 'Agent ID' },
          { type: 'raw_text', text: 'Role' },
          { type: 'raw_text', text: 'Status' },
          { type: 'raw_text', text: 'Model' }
        ],
        // Data
        ...pageAgents.map(agent => [
          { type: 'raw_text', text: agent.id },
          { type: 'raw_text', text: agent.role },
          {
            type: 'rich_text',
            elements: [{
              type: 'rich_text_section',
              elements: [
                {
                  type: 'emoji',
                  name: agent.status === 'connected' ? 'green_circle' : 'red_circle'
                },
                { type: 'text', text: ` ${agent.status}` }
              ]
            }]
          },
          { type: 'raw_text', text: agent.model }
        ])
      ];

      await this.client.chat.postMessage({
        channel: this.channelId,
        text: 'Agent Status',
        attachments: [{
          blocks: [{
            type: 'table',
            column_settings: [
              { is_wrapped: false },
              { is_wrapped: true },
              { align: 'center' },
              { is_wrapped: true }
            ],
            rows
          }]
        }]
      });
    }
  }

  /**
   * Section blocks format (1-5 agents)
   */
  private async sendAgentSections(agents: Agent[]): Promise<void> {
    const blocks: Block[] = [
      { type: 'header', text: { type: 'plain_text', text: 'Agent Status' } },
      { type: 'divider' }
    ];

    agents.forEach(agent => {
      blocks.push({
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Agent:*\n\`${agent.id}\`` },
          { type: 'mrkdwn', text: `*Role:*\n${agent.role}` },
          { type: 'mrkdwn', text: `*Status:*\n:${agent.status === 'connected' ? 'green' : 'red'}_circle: ${agent.status}` },
          { type: 'mrkdwn', text: `*Model:*\n\`${agent.model}\`` }
        ]
      });
    });

    await this.client.chat.postMessage({
      channel: this.channelId,
      text: 'Agent Status',
      blocks
    });
  }

  /**
   * Simple text format (very simple messages)
   */
  async sendSimpleList(title: string, items: string[]): Promise<void> {
    const text = [
      `*${title}*`,
      ...items.map(item => `• ${item}`),
      '',
      `_Total: ${items.length}_`
    ].join('\n');

    await this.client.chat.postMessage({
      channel: this.channelId,
      text,
      mrkdwn: true
    });
  }

  /**
   * Error message
   */
  async sendError(error: { code: string; message: string }): Promise<void> {
    await this.client.chat.postMessage({
      channel: this.channelId,
      text: `Error: ${error.message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:x: *Error ${error.code}*\n${error.message}`
          }
        }
      ]
    });
  }

  private paginateAgents(agents: Agent[], pageSize: number): Agent[][] {
    const pages: Agent[][] = [];
    for (let i = 0; i < agents.length; i += pageSize) {
      pages.push(agents.slice(i, i + pageSize));
    }
    return pages;
  }
}

// Usage
const formatter = new SlackMessageFormatter(
  new WebClient(process.env.SLACK_BOT_TOKEN!),
  'C1234567890'
);

// Automatically chooses best format based on agent count
await formatter.sendAgentStatus(agents);

// Force specific formats
await formatter.sendSimpleList('Connected Agents', agents.map(a => a.id));
await formatter.sendError({ code: 'AUTH001', message: 'Authentication failed' });
```

---

## Implementation Recommendations

### 1. Integration with SlackChannel.ts

Add the formatting methods to the existing `SlackChannel` class:

```typescript
// File: C:/projects/coorchat/packages/mcp-server/src/channels/slack/SlackChannel.ts

import { Block } from '@slack/web-api';

export class SlackChannel extends ChannelAdapter {
  // ... existing code ...

  /**
   * Send a formatted agent status table
   */
  async sendAgentStatusTable(agents: Array<{
    id: string;
    role: string;
    status: string;
    model: string;
  }>): Promise<void> {
    const rows = [
      [
        { type: 'raw_text', text: 'Agent ID' },
        { type: 'raw_text', text: 'Role' },
        { type: 'raw_text', text: 'Status' },
        { type: 'raw_text', text: 'Model' }
      ],
      ...agents.map(agent => [
        { type: 'raw_text', text: agent.id },
        { type: 'raw_text', text: agent.role },
        { type: 'raw_text', text: agent.status },
        { type: 'raw_text', text: agent.model }
      ])
    ];

    await this.webClient.chat.postMessage({
      channel: this.slackConfig.channelId,
      text: 'Agent Status Report',
      attachments: [{
        blocks: [{
          type: 'table',
          column_settings: [
            { is_wrapped: false },
            { is_wrapped: true },
            { align: 'center' },
            { is_wrapped: true }
          ],
          rows
        }]
      }]
    });
  }

  /**
   * Send blocks message (for rich formatting)
   */
  async sendBlocks(blocks: Block[], fallbackText: string): Promise<void> {
    await this.webClient.chat.postMessage({
      channel: this.slackConfig.channelId,
      text: fallbackText,
      blocks
    });
  }

  /**
   * Send formatted error message
   */
  async sendError(error: { code: string; message: string; details?: string }): Promise<void> {
    await this.webClient.chat.postMessage({
      channel: this.slackConfig.channelId,
      text: `Error: ${error.message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:x: *Error ${error.code}*\n${error.message}`
          }
        },
        ...(error.details ? [{
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `\`\`\`${error.details}\`\`\``
          }]
        }] : [])
      ]
    });
  }
}
```

### 2. Character Limit Guidelines

| Format | Soft Limit | Hard Limit | Recommendation |
|--------|-----------|------------|----------------|
| `text` field (mrkdwn) | 4,000 chars | 40,000 chars | Paginate at 3,500 |
| Block `text` field | 3,000 chars | 3,000 chars | Split into multiple blocks |
| Table block (total) | ~12,000 chars | Varies | Paginate at 90 rows |
| Total message | 16 KB | 16 KB | Monitor total JSON size |

### 3. Mobile Experience Considerations

**Block Kit Table**:
- Horizontal scrolling works well
- Native table rendering
- Best for 4-6 columns max

**Section Blocks**:
- Fields auto-stack on mobile (2 columns → 1 column)
- Good for key-value pairs
- Use short field labels

**mrkdwn**:
- Text wraps naturally
- Use monospace for alignment only on desktop
- Avoid ASCII art tables (breaks on mobile)

---

## Final Recommendation

**Use the Hybrid Approach:**

1. **Agent tables (10+ agents)**: Block Kit Table Block
   - Best mobile UX
   - Proper semantic structure
   - Professional appearance

2. **Small status displays (1-5 agents)**: Block Kit Sections
   - Good visual hierarchy
   - Flexible layout
   - Rich formatting

3. **Simple lists**: mrkdwn
   - Fast to implement
   - Lightweight
   - Good for quick responses

4. **Error messages**: Block Kit Sections
   - Visual prominence
   - Context and details support

5. **Help documentation**: Block Kit Sections
   - Clear structure
   - Good readability

**Implementation Priority:**
1. Add `sendAgentStatusTable()` method for table support
2. Add `sendBlocks()` helper for flexible block messages
3. Add `sendError()` for consistent error formatting
4. Use existing `sendText()` for simple messages

---

## Sources

- [Slack Table Block Documentation](https://docs.slack.dev/reference/block-kit/blocks/table-block/)
- [Slack Block Kit Reference](https://api.slack.com/block-kit)
- [Slack Message Formatting](https://docs.slack.dev/messaging/formatting-message-text/)
- [Slack Markdown Guide](https://www.suptask.com/blog/slack-markdown-full-guide)
- [Slack Message Character Limits](https://docs.slack.dev/changelog/2018-truncating-really-long-messages/)
- [Node.js Slack SDK Documentation](https://github.com/slackapi/node-slack-sdk)
- [Creating Rich Message Layouts](https://api.slack.com/messaging/composing/layouts)
