/**
 * SignalR Integration Test
 * Tests the complete SignalR relay server integration
 */

import * as signalR from '@microsoft/signalr';
import * as https from 'https';

// Allow self-signed certificates in development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const RELAY_URL = 'https://localhost:5001/agentHub';
const TOKEN = 'cct_development_token_change_this_in_production';

interface AgentMessage {
  protocolVersion: string;
  messageType: string;
  senderId: string;
  recipientId?: string;
  timestamp: string;
  correlationId?: string;
  priority: string;
  payload?: any;
  metadata?: Record<string, any>;
}

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function pass(test: string, message: string) {
  results.push({ test, passed: true, message });
  console.log(`✅ ${test}: ${message}`);
}

function fail(test: string, message: string) {
  results.push({ test, passed: false, message });
  console.log(`❌ ${test}: ${message}`);
}

async function runTests() {
  console.log('🧪 Starting SignalR Integration Tests\n');
  console.log('Server:', RELAY_URL);
  console.log('');

  // Create two agent connections
  const agent1 = new signalR.HubConnectionBuilder()
    .withUrl(RELAY_URL, {
      accessTokenFactory: () => TOKEN
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  const agent2 = new signalR.HubConnectionBuilder()
    .withUrl(RELAY_URL, {
      accessTokenFactory: () => TOKEN
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  const messagesReceived = {
    agent1: [] as AgentMessage[],
    agent2: [] as AgentMessage[],
  };

  const eventsReceived = {
    agent1: [] as any[],
    agent2: [] as any[],
  };

  // Setup message handlers
  agent1.on('ReceiveMessage', (msg: AgentMessage) => {
    messagesReceived.agent1.push(msg);
    console.log('📨 Agent1 received:', msg.messageType, 'from', msg.senderId);
  });

  agent2.on('ReceiveMessage', (msg: AgentMessage) => {
    messagesReceived.agent2.push(msg);
    console.log('📨 Agent2 received:', msg.messageType, 'from', msg.senderId);
  });

  agent1.on('AgentConnected', (info: any) => {
    eventsReceived.agent1.push({ event: 'AgentConnected', ...info });
    console.log('🔔 Agent1 notified: Agent connected -', info.agentId);
  });

  agent2.on('AgentConnected', (info: any) => {
    eventsReceived.agent2.push({ event: 'AgentConnected', ...info });
    console.log('🔔 Agent2 notified: Agent connected -', info.agentId);
  });

  agent1.on('AgentDisconnected', (info: any) => {
    eventsReceived.agent1.push({ event: 'AgentDisconnected', ...info });
    console.log('🔔 Agent1 notified: Agent disconnected -', info.agentId);
  });

  agent2.on('AgentDisconnected', (info: any) => {
    eventsReceived.agent2.push({ event: 'AgentDisconnected', ...info });
    console.log('🔔 Agent2 notified: Agent disconnected -', info.agentId);
  });

  try {
    // Test 1: Connection
    console.log('\n📍 Test 1: Connection');
    await agent1.start();
    pass('Connection', 'Agent1 connected successfully');
    await new Promise(resolve => setTimeout(resolve, 500));

    await agent2.start();
    pass('Connection', 'Agent2 connected successfully');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 2: Agent Registration
    console.log('\n📍 Test 2: Agent Registration');
    await agent1.invoke('RegisterAgent', 'dev-agent-1', 'developer', {
      platform: 'Node.js',
      version: '1.0.0'
    });
    pass('Registration', 'Agent1 registered as developer');

    await agent2.invoke('RegisterAgent', 'test-agent-1', 'tester', {
      platform: 'Node.js',
      version: '1.0.0'
    });
    pass('Registration', 'Agent2 registered as tester');

    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 3: Agent Connected Events
    console.log('\n📍 Test 3: Agent Connected Events');
    if (eventsReceived.agent1.some(e => e.event === 'AgentConnected' && e.agentId === 'test-agent-1')) {
      pass('Events', 'Agent1 received AgentConnected event for Agent2');
    } else {
      fail('Events', 'Agent1 did not receive AgentConnected event');
    }

    if (eventsReceived.agent2.some(e => e.event === 'AgentConnected' && e.agentId === 'dev-agent-1')) {
      pass('Events', 'Agent2 received AgentConnected event for Agent1');
    } else {
      fail('Events', 'Agent2 did not receive AgentConnected event');
    }

    // Test 4: Broadcast Message
    console.log('\n📍 Test 4: Broadcast Message');
    const broadcastMsg: AgentMessage = {
      protocolVersion: '1.0.0',
      messageType: 'TASK_ASSIGNED',
      senderId: 'dev-agent-1',
      timestamp: new Date().toISOString(),
      priority: 'high',
      payload: {
        taskId: 'task-123',
        description: 'Implement feature X'
      }
    };

    await agent1.invoke('SendMessage', broadcastMsg);
    pass('Broadcast', 'Agent1 sent broadcast message');

    await new Promise(resolve => setTimeout(resolve, 500));

    if (messagesReceived.agent2.some(m => m.messageType === 'TASK_ASSIGNED')) {
      pass('Broadcast', 'Agent2 received broadcast message');
    } else {
      fail('Broadcast', 'Agent2 did not receive broadcast message');
    }

    // Test 5: Unicast Message
    console.log('\n📍 Test 5: Unicast Message');
    const unicastMsg: AgentMessage = {
      protocolVersion: '1.0.0',
      messageType: 'STATUS_QUERY',
      senderId: 'test-agent-1',
      recipientId: 'dev-agent-1',
      timestamp: new Date().toISOString(),
      priority: 'medium',
      payload: {
        query: 'What is your status?'
      }
    };

    await agent2.invoke('SendMessageToAgent', 'dev-agent-1', unicastMsg);
    pass('Unicast', 'Agent2 sent unicast message to Agent1');

    await new Promise(resolve => setTimeout(resolve, 500));

    if (messagesReceived.agent1.some(m => m.messageType === 'STATUS_QUERY')) {
      pass('Unicast', 'Agent1 received unicast message');
    } else {
      fail('Unicast', 'Agent1 did not receive unicast message');
    }

    // Test 6: Heartbeat
    console.log('\n📍 Test 6: Heartbeat');
    let heartbeatReceived = false;
    agent1.on('HeartbeatAck', (ack: any) => {
      heartbeatReceived = true;
      console.log('💓 Heartbeat ACK:', ack);
    });

    await agent1.invoke('Heartbeat');
    await new Promise(resolve => setTimeout(resolve, 500));

    if (heartbeatReceived) {
      pass('Heartbeat', 'Heartbeat ACK received');
    } else {
      fail('Heartbeat', 'Heartbeat ACK not received');
    }

    // Test 7: Get Connected Agents
    console.log('\n📍 Test 7: Get Connected Agents');
    let connectedAgents: any[] = [];
    agent1.on('ConnectedAgents', (agents: any[]) => {
      connectedAgents = agents;
      console.log('📋 Connected agents:', agents.map(a => a.AgentId));
    });

    await agent1.invoke('GetConnectedAgents');
    await new Promise(resolve => setTimeout(resolve, 500));

    if (connectedAgents.length >= 2) {
      pass('GetConnectedAgents', `Found ${connectedAgents.length} connected agents`);
    } else {
      fail('GetConnectedAgents', `Expected 2+ agents, found ${connectedAgents.length}`);
    }

    // Test 8: Query Status
    console.log('\n📍 Test 8: Query Status');
    let agentStatus: any = null;
    agent1.on('AgentStatus', (status: any) => {
      agentStatus = status;
      console.log('📊 Agent status:', status);
    });

    await agent1.invoke('QueryStatus', 'test-agent-1');
    await new Promise(resolve => setTimeout(resolve, 500));

    if (agentStatus && agentStatus.isConnected) {
      pass('QueryStatus', 'Agent status query successful');
    } else {
      fail('QueryStatus', 'Agent status query failed');
    }

    // Test 9: Statistics API
    console.log('\n📍 Test 9: Statistics API');
    const statsResponse = await fetch('https://localhost:5001/api/stats', {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      },
      // @ts-ignore - Node.js specific option
      agent: new https.Agent({ rejectUnauthorized: false })
    });
    const stats = await statsResponse.json();

    if (stats.totalConnections >= 2) {
      pass('Statistics API', `Stats API returned ${stats.totalConnections} connections`);
    } else {
      fail('Statistics API', `Expected 2+ connections, got ${stats.totalConnections}`);
    }

    // Test 10: Disconnect and Events
    console.log('\n📍 Test 10: Disconnect Events');
    await agent2.stop();
    pass('Disconnect', 'Agent2 disconnected');

    await new Promise(resolve => setTimeout(resolve, 500));

    if (eventsReceived.agent1.some(e => e.event === 'AgentDisconnected' && e.agentId === 'test-agent-1')) {
      pass('Disconnect Events', 'Agent1 received AgentDisconnected event');
    } else {
      fail('Disconnect Events', 'Agent1 did not receive AgentDisconnected event');
    }

    // Cleanup
    await agent1.stop();
    console.log('\n✅ Agent1 disconnected');

  } catch (error) {
    fail('Exception', `Error during tests: ${error}`);
    console.error(error);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.test}: ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
