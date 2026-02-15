#!/usr/bin/env node
/**
 * CoorChat CLI - Command-line interface for managing agents
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { TokenGenerator } from '../config/TokenGenerator.js';
import { ChannelFactory } from '../channels/base/ChannelFactory.js';
import { RoleManager } from '../agents/RoleManager.js';
import type { ChannelConfig } from '../channels/base/Channel.js';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('coorchat')
  .description('CoorChat CLI - Multi-Agent Coordination System')
  .version('1.0.0');

// Token commands
const tokenCmd = program.command('token').description('Token management commands');

tokenCmd
  .command('generate')
  .description('Generate a secure token')
  .option('-t, --type <type>', 'Token type (channel, api, webhook)', 'channel')
  .option('-c, --count <count>', 'Number of tokens to generate', '1')
  .action((options) => {
    const count = parseInt(options.count);
    const tokens: string[] = [];

    for (let i = 0; i < count; i++) {
      let token: string;
      switch (options.type) {
        case 'channel':
          token = TokenGenerator.generateChannelToken();
          break;
        case 'api':
          token = TokenGenerator.generateAPIToken();
          break;
        case 'webhook':
          token = TokenGenerator.generateWebhookSecret();
          break;
        default:
          console.error(`Invalid token type: ${options.type}`);
          process.exit(1);
      }
      tokens.push(token);
    }

    console.log('Generated tokens:');
    tokens.forEach((token, index) => {
      console.log(`${index + 1}. ${token}`);
    });

    if (count === 1) {
      console.log('\nAdd to your .env file:');
      console.log(`SHARED_TOKEN=${tokens[0]}`);
    }
  });

tokenCmd
  .command('validate <token>')
  .description('Validate token format')
  .action((token) => {
    const isValid = TokenGenerator.validateFormat(token);
    if (isValid) {
      console.log('✅ Token is valid');
      console.log(`Length: ${token.length} characters`);
      if (token.startsWith('cct_')) {
        console.log('Type: Channel Token');
      } else if (token.startsWith('cca_')) {
        console.log('Type: API Token');
      } else {
        console.log('Type: Generic');
      }
    } else {
      console.log('❌ Token is invalid');
      console.log('Requirements:');
      console.log('  - Minimum 16 characters');
      console.log('  - Alphanumeric with _ and -');
      console.log('  - No whitespace');
    }
  });

tokenCmd
  .command('hash <token>')
  .description('Hash a token (SHA-256)')
  .action((token) => {
    const hash = TokenGenerator.hash(token);
    console.log('Token hash:');
    console.log(hash);
  });

// Agent commands
const agentCmd = program.command('agent').description('Agent management commands');

agentCmd
  .command('start')
  .description('Start an agent')
  .option('-i, --id <id>', 'Agent ID')
  .option('-r, --role <role>', 'Agent role', 'developer')
  .option('-c, --channel <channel>', 'Channel type', process.env.CHANNEL_TYPE || 'redis')
  .action(async (options) => {
    const agentId = options.id || `agent-${Date.now()}`;
    const role = options.role;

    console.log(`🤖 Starting agent: ${agentId}`);
    console.log(`   Role: ${role}`);
    console.log(`   Channel: ${options.channel}`);
    console.log('');

    try {
      // Create channel config
      const config: ChannelConfig = {
        type: options.channel,
        token: process.env.SHARED_TOKEN || '',
        connectionParams: getConnectionParams(options.channel),
      };

      // Validate token
      if (!config.token || config.token.length < 16) {
        console.error('❌ Invalid or missing SHARED_TOKEN in environment');
        console.error('Run: coorchat token generate');
        process.exit(1);
      }

      // Create channel
      const channel = ChannelFactory.create(config);
      await channel.connect();

      console.log('✅ Connected to channel');

      // Listen for messages
      channel.onMessage((message) => {
        console.log(`📨 [${message.messageType}] from ${message.senderId}`);
        if (message.payload) {
          console.log(`   ${JSON.stringify(message.payload, null, 2)}`);
        }
      });

      // Keep alive
      console.log('');
      console.log('Agent is running. Press Ctrl+C to stop.');
      console.log('');

      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n\n🛑 Shutting down...');
        await channel.disconnect();
        console.log('✅ Disconnected');
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {});
    } catch (error) {
      console.error('❌ Failed to start agent:', error);
      process.exit(1);
    }
  });

agentCmd
  .command('list')
  .description('List active agents')
  .action(async () => {
    // This would need a shared state store (Redis, etc.)
    console.log('📋 Active Agents:');
    console.log('(This feature requires a shared state store)');
  });

// Role commands
const roleCmd = program.command('role').description('Role management commands');

roleCmd
  .command('list')
  .description('List available roles')
  .action(() => {
    const roleManager = new RoleManager();
    const roles = roleManager.getPredefinedRoles();

    console.log('📋 Available Roles:\n');
    roles.forEach((role) => {
      console.log(`${role.name}:`);
      console.log(`  Description: ${role.description}`);
      const caps = role.suggestedCapabilities;
      if (caps) {
        const allCaps = [...(caps.tools || []), ...(caps.languages || [])];
        console.log(`  Capabilities: ${allCaps.join(', ')}`);
      }
      console.log('');
    });
  });

roleCmd
  .command('suggest <...capabilities>')
  .description('Suggest roles based on capabilities')
  .action((capabilities: string) => {
    const roleManager = new RoleManager();
    const capList = capabilities.split(',').map((c: string) => c.trim());
    const suggestions = roleManager.suggestRoles({ tools: capList });

    if (suggestions.length > 0) {
      console.log('💡 Suggested Roles:\n');
      suggestions.forEach((role: { name: string; description: string }, index: number) => {
        console.log(`${index + 1}. ${role.name}`);
        console.log(`   ${role.description}`);
        console.log('');
      });
    } else {
      console.log('No matching roles found');
    }
  });

// Config commands
const configCmd = program.command('config').description('Configuration commands');

configCmd
  .command('show')
  .description('Show current configuration')
  .action(() => {
    console.log('⚙️  Current Configuration:\n');
    console.log(`Channel Type: ${process.env.CHANNEL_TYPE || '(not set)'}`);
    console.log(`Agent ID: ${process.env.AGENT_ID || '(not set)'}`);
    console.log(`Agent Role: ${process.env.AGENT_ROLE || '(not set)'}`);
    console.log(`Shared Token: ${process.env.SHARED_TOKEN ? '***' + process.env.SHARED_TOKEN.slice(-8) : '(not set)'}`);
    console.log('');

    if (process.env.CHANNEL_TYPE === 'redis') {
      console.log('Redis Configuration:');
      console.log(`  Host: ${process.env.REDIS_HOST || 'localhost'}`);
      console.log(`  Port: ${process.env.REDIS_PORT || '6379'}`);
      console.log(`  TLS: ${process.env.REDIS_TLS || 'false'}`);
    } else if (process.env.CHANNEL_TYPE === 'discord') {
      console.log('Discord Configuration:');
      console.log(`  Bot Token: ${process.env.DISCORD_BOT_TOKEN ? '***' : '(not set)'}`);
      console.log(`  Channel ID: ${process.env.DISCORD_CHANNEL_ID || '(not set)'}`);
    } else if (process.env.CHANNEL_TYPE === 'signalr') {
      console.log('SignalR Configuration:');
      console.log(`  Hub URL: ${process.env.SIGNALR_HUB_URL || '(not set)'}`);
    } else if (process.env.CHANNEL_TYPE === 'slack') {
      console.log('Slack Configuration:');
      console.log(`  Bot Token: ${process.env.SLACK_BOT_TOKEN ? '***' : '(not set)'}`);
      console.log(`  App Token: ${process.env.SLACK_APP_TOKEN ? '***' : '(not set)'}`);
      console.log(`  Channel ID: ${process.env.SLACK_CHANNEL_ID || '(not set)'}`);
      console.log(`  Team ID: ${process.env.SLACK_TEAM_ID || '(not set)'}`);
    }

    console.log('');

    if (process.env.GITHUB_TOKEN) {
      console.log('GitHub Integration:');
      console.log(`  Token: ***${process.env.GITHUB_TOKEN.slice(-8)}`);
      console.log(`  Owner: ${process.env.GITHUB_OWNER || '(not set)'}`);
      console.log(`  Repo: ${process.env.GITHUB_REPO || '(not set)'}`);
      console.log('');
    }
  });

configCmd
  .command('init')
  .description('Initialize configuration file')
  .option('-c, --channel <type>', 'Channel type (redis, discord, signalr, slack)', 'redis')
  .action((options) => {
    const token = TokenGenerator.generateChannelToken();

    const envContent = `# CoorChat Configuration
# Generated: ${new Date().toISOString()}

# Shared authentication token (use same token for all agents)
SHARED_TOKEN=${token}

# Channel configuration
CHANNEL_TYPE=${options.channel}
${options.channel === 'redis' ? `REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TLS=false` : ''}
${options.channel === 'discord' ? `DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CHANNEL_ID=your_channel_id_here` : ''}
${options.channel === 'signalr' ? `SIGNALR_HUB_URL=https://localhost:5001/agentHub` : ''}
${options.channel === 'slack' ? `SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_CHANNEL_ID=C0123456789
# SLACK_TEAM_ID=T0123456789` : ''}

# Agent configuration
AGENT_ID=agent-${Date.now()}
AGENT_ROLE=developer

# Optional: GitHub integration
# GITHUB_TOKEN=ghp_your_token_here
# GITHUB_OWNER=your-org
# GITHUB_REPO=your-repo

# Logging
LOG_LEVEL=info
`;

    console.log(envContent);
    console.log('💾 Save this to .env file in packages/mcp-server/');
  });

// Monitor command
program
  .command('monitor')
  .description('Monitor agent coordination activity')
  .option('-c, --channel <channel>', 'Channel type', process.env.CHANNEL_TYPE || 'redis')
  .action(async (options) => {
    console.log('👁️  CoorChat Monitor\n');
    console.log('Listening for agent activity...\n');

    try {
      const config: ChannelConfig = {
        type: options.channel,
        token: process.env.SHARED_TOKEN || '',
        connectionParams: getConnectionParams(options.channel),
      };

      const channel = ChannelFactory.create(config);
      await channel.connect();

      console.log(`✅ Connected to ${options.channel} channel\n`);

      channel.onMessage((message) => {
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        console.log(`[${timestamp}] ${message.messageType}`);
        console.log(`  From: ${message.senderId}`);
        if (message.recipientId) {
          console.log(`  To: ${message.recipientId}`);
        }
        if (message.payload) {
          console.log(`  Payload: ${JSON.stringify(message.payload, null, 2)}`);
        }
        console.log('');
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n\n🛑 Stopping monitor...');
        await channel.disconnect();
        console.log('✅ Disconnected');
        process.exit(0);
      });

      // Keep alive
      await new Promise(() => {});
    } catch (error) {
      console.error('❌ Failed to start monitor:', error);
      process.exit(1);
    }
  });

// Helper function to get connection params
function getConnectionParams(channelType: string): any {
  switch (channelType) {
    case 'redis':
      return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true',
      };
    case 'discord':
      return {
        botToken: process.env.DISCORD_BOT_TOKEN,
        channelId: process.env.DISCORD_CHANNEL_ID,
      };
    case 'signalr':
      return {
        hubUrl: process.env.SIGNALR_HUB_URL || 'https://localhost:5001/agentHub',
      };
    case 'slack':
      return {
        botToken: process.env.SLACK_BOT_TOKEN,
        appToken: process.env.SLACK_APP_TOKEN,
        channelId: process.env.SLACK_CHANNEL_ID,
        teamId: process.env.SLACK_TEAM_ID,
      };
    default:
      return {};
  }
}

// Parse CLI arguments
program.parse();
