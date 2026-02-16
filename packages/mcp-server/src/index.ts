#!/usr/bin/env node
/**
 * CoorChat MCP Server - Main Entry Point
 * Starts an agent and connects to the configured channel
 */

import * as dotenv from 'dotenv';
import { SlackChannel } from './channels/slack/SlackChannel.js';
import type { ChannelConfig } from './channels/base/Channel.js';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting CoorChat MCP Server...\n');

  // Validate required environment variables
  const requiredVars = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_CHANNEL_ID'];
  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease check your .env file.');
    process.exit(1);
  }

  // Create channel configuration
  const config: ChannelConfig = {
    type: 'slack',
    token: process.env.SHARED_TOKEN || 'default-token',
    connectionParams: {
      botToken: process.env.SLACK_BOT_TOKEN!,
      appToken: process.env.SLACK_APP_TOKEN!,
      channelId: process.env.SLACK_CHANNEL_ID!,
      teamId: process.env.SLACK_TEAM_ID,
    },
  };

  // Create and connect Slack channel
  const channel = new SlackChannel(config);

  // Set up protocol message handler
  channel.onMessage((message) => {
    console.log('📨 Received protocol message:', {
      type: message.messageType,
      from: message.senderId,
      timestamp: message.timestamp,
    });
  });

  // Initialize command infrastructure
  const { CommandRegistry } = await import('./commands/CommandRegistry.js');
  const { AgentRegistry } = await import('./agents/AgentRegistry.js');
  const { AgentStatus } = await import('./agents/Agent.js');
  const { TaskManager } = await import('./tasks/TaskManager.js');

  // Create agent registry and task manager
  const agentRegistry = new AgentRegistry({ enableTimeoutChecking: true });
  const taskManager = new TaskManager();

  // Register this agent instance
  const agentId = process.env.AGENT_ID || 'default-agent';
  const agentRole = process.env.AGENT_ROLE || 'developer';

  // Determine platform
  let platform: 'Linux' | 'Windows' | 'macOS' = 'Linux';
  if (process.platform === 'win32') platform = 'Windows';
  else if (process.platform === 'darwin') platform = 'macOS';

  await agentRegistry.add({
    id: agentId,
    role: agentRole,
    platform,
    environment: 'local',
    capabilities: {
      agentId,
      roleType: agentRole,
      platform,
      environmentType: 'local',
      tools: ['slack', 'node', 'typescript'],
      languages: ['typescript', 'javascript'],
    },
    status: AgentStatus.CONNECTED,
    currentTask: null,
    registeredAt: new Date(),
    lastSeenAt: new Date(),
  });

  // Import task execution components
  const { TaskExecutor } = await import('./tasks/TaskExecutor.js');
  const { TaskWorker } = await import('./tasks/TaskWorker.js');

  // Create task executor and worker
  const executor = new TaskExecutor({
    workingDirectory: process.env.TASK_WORKING_DIR || process.cwd(),
    timeoutMs: parseInt(process.env.TASK_TIMEOUT_MS || '600000', 10),
  });

  const worker = new TaskWorker({
    agentId,
    taskManager,
    executor,
    channel,
    agentRegistry,
  });

  // Create command registry with full dependencies (worker set after)
  const commandRegistry = new CommandRegistry(channel, agentRegistry, taskManager);
  commandRegistry.setWorker(worker);

  // Wake worker when tasks are added for this agent
  taskManager.onTaskAdded((addedAgentId) => {
    if (addedAgentId.toLowerCase() === agentId.toLowerCase()) {
      worker.notify();
    }
  });

  // Set up text message handler (for plain text messages)
  channel.onTextMessage(async (text, userId) => {
    console.log('💬 Received text message:', {
      text,
      from: userId,
      timestamp: new Date().toISOString(),
    });

    // Handle legacy ping command (for backward compatibility)
    if (text.trim().toLowerCase() === 'ping') {
      const agentName = process.env.AGENT_ID || 'unknown';
      const response = `pong - ${agentName}`;

      console.log(`🏓 Responding to ping with: ${response}`);

      try {
        await channel.sendText(response);
        console.log('✅ Pong sent successfully');
      } catch (error) {
        console.error('❌ Failed to send pong:', error);
      }
      return;
    }

    // Route all other messages to CommandRegistry
    try {
      await commandRegistry.handleCommand(text, userId);
    } catch (error) {
      console.error('❌ Command handling error:', error);
    }
  });

  // Set up error handler
  channel.onError((error) => {
    console.error('❌ Channel error:', error.message);
  });

  // Set up connection state handler
  channel.onConnectionStateChange((state) => {
    console.log(`🔄 Connection state: ${state}`);
  });

  try {
    console.log('📡 Connecting to Slack...');
    await channel.connect();
    console.log('✅ Connected successfully!');
    console.log(`📍 Channel ID: ${process.env.SLACK_CHANNEL_ID}`);
    console.log(`🤖 Agent ID: ${agentId}`);
    console.log(`👤 Agent Role: ${agentRole}`);
    console.log(`📊 Agent Registry: ${agentRegistry.getAll().length} agent(s) registered`);
    console.log(`📝 Commands available: 30+ (type "help" in Slack)`);

    // Start the task worker
    worker.start();
    console.log(`⚙️  Task worker started`);

    console.log('\n💬 Waiting for messages...\n');
  } catch (error) {
    console.error('❌ Failed to connect:', error);
    process.exit(1);
  }

  // Start heartbeat to keep local agent showing as connected
  // Send heartbeat every 15 seconds (half the 30-second timeout)
  const heartbeatInterval = setInterval(async () => {
    try {
      await agentRegistry.heartbeat(agentId);
    } catch (error) {
      console.error('❌ Failed to send heartbeat:', error);
    }
  }, 15000);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n\n👋 Shutting down...');
    await worker.stop();
    clearInterval(heartbeatInterval);
    agentRegistry.destroy();
    await channel.disconnect();
    console.log('✅ Disconnected');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
