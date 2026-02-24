/**
 * MCP Tester Service
 *
 * Tests MCP server connectivity via JSON-RPC protocol.
 * Spawns servers, sends initialize handshake, lists tools.
 */

import { spawn, type ChildProcess } from 'child_process';
import { readMcpConfig, writeMcpConfig, type MCPServer } from './config-manager';

// ============================================================
// Types
// ============================================================

export interface MCPServerStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  toolCount?: number;
  error?: string;
  lastChecked: string;
  command?: string;
  args?: string[];
  disabled?: boolean;
}

export interface MCPTool {
  name: string;
  description?: string;
}

export interface MCPResource {
  uri: string;
  name?: string;
}

export interface MCPTestResult {
  success: boolean;
  tools?: MCPTool[];
  resources?: MCPResource[];
  error?: string;
  durationMs: number;
  serverInfo?: {
    name?: string;
    version?: string;
  };
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ============================================================
// JSON-RPC Helpers
// ============================================================

let requestId = 0;

function createRequest(method: string, params?: Record<string, unknown>): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: ++requestId,
    method,
    params,
  };
}

function parseResponse(line: string): JsonRpcResponse | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed.jsonrpc === '2.0' && 'id' in parsed) {
      return parsed as JsonRpcResponse;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Server Testing
// ============================================================

/**
 * Test an MCP server via JSON-RPC handshake
 * Spawns the server, sends initialize, lists tools, then kills the process
 */
export async function testMCPServer(serverName: string): Promise<MCPTestResult> {
  const startTime = Date.now();

  const config = readMcpConfig();
  const serverConfig = config.mcpServers?.[serverName];

  if (!serverConfig) {
    return {
      success: false,
      error: `Server "${serverName}" not found in config`,
      durationMs: Date.now() - startTime,
    };
  }

  const timeout = 10000; // 10 second timeout
  let proc: ChildProcess | null = null;
  let resolved = false;

  return new Promise((resolve) => {
    const finish = (result: MCPTestResult) => {
      if (resolved) return;
      resolved = true;

      if (proc) {
        try {
          proc.kill('SIGTERM');
        } catch {
          // Ignore kill errors
        }
      }

      resolve(result);
    };

    // Timeout handler
    const timeoutId = setTimeout(() => {
      finish({
        success: false,
        error: 'Connection timeout (10s)',
        durationMs: Date.now() - startTime,
      });
    }, timeout);

    try {
      // Prepare environment
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        ...(serverConfig.env || {}),
      };

      // Spawn the server process
      proc = spawn(serverConfig.command, serverConfig.args || [], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';
      let serverInfo: { name?: string; version?: string } | undefined;
      let tools: MCPTool[] = [];
      let initializeComplete = false;

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();

        // Process line by line
        const lines = stdout.split('\n');
        stdout = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;

          const response = parseResponse(line);
          if (!response) continue;

          if (response.error) {
            clearTimeout(timeoutId);
            finish({
              success: false,
              error: response.error.message,
              durationMs: Date.now() - startTime,
            });
            return;
          }

          // Handle initialize response
          if (response.result && !initializeComplete) {
            const result = response.result as {
              serverInfo?: { name?: string; version?: string };
              capabilities?: Record<string, unknown>;
            };
            serverInfo = result.serverInfo;
            initializeComplete = true;

            // Send initialized notification (no id, it's a notification)
            const notification = { jsonrpc: '2.0', method: 'notifications/initialized' };
            proc?.stdin?.write(JSON.stringify(notification) + '\n');

            // Now request tools list
            const toolsRequest = createRequest('tools/list');
            proc?.stdin?.write(JSON.stringify(toolsRequest) + '\n');
            return;
          }

          // Handle tools/list response
          if (response.result && initializeComplete) {
            const result = response.result as { tools?: MCPTool[] };
            tools = result.tools || [];

            clearTimeout(timeoutId);
            finish({
              success: true,
              tools,
              serverInfo,
              durationMs: Date.now() - startTime,
            });
            return;
          }
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        finish({
          success: false,
          error: `Failed to spawn: ${error.message}`,
          durationMs: Date.now() - startTime,
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          finish({
            success: false,
            error: stderr || `Process exited with code ${code}`,
            durationMs: Date.now() - startTime,
          });
        }
      });

      // Send initialize request
      const initRequest = createRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'claude-session-manager',
          version: '1.0.0',
        },
      });

      proc.stdin?.write(JSON.stringify(initRequest) + '\n');
    } catch (error) {
      clearTimeout(timeoutId);
      finish({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      });
    }
  });
}

/**
 * Get status of all MCP servers
 * Quick check based on config, not full connection test
 */
export async function getMCPServerStatuses(): Promise<MCPServerStatus[]> {
  const config = readMcpConfig();
  const servers = config.mcpServers || {};
  const statuses: MCPServerStatus[] = [];

  for (const [name, server] of Object.entries(servers)) {
    statuses.push({
      name,
      status: server.disabled ? 'stopped' : 'running',
      command: server.command,
      args: server.args,
      disabled: server.disabled,
      lastChecked: new Date().toISOString(),
    });
  }

  // Sort alphabetically
  statuses.sort((a, b) => a.name.localeCompare(b.name));

  return statuses;
}

/**
 * Toggle an MCP server's enabled/disabled state
 */
export async function toggleMCPServer(
  serverName: string,
  enabled: boolean
): Promise<void> {
  const config = readMcpConfig();

  if (!config.mcpServers?.[serverName]) {
    throw new Error(`Server "${serverName}" not found`);
  }

  if (enabled) {
    // Remove disabled flag
    delete config.mcpServers[serverName].disabled;
  } else {
    // Set disabled flag
    config.mcpServers[serverName].disabled = true;
  }

  writeMcpConfig(config);
  console.log(`[MCPTester] Toggled ${serverName} to ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Add a new MCP server to config
 */
export async function addMCPServer(
  name: string,
  command: string,
  args?: string[],
  env?: Record<string, string>
): Promise<void> {
  const config = readMcpConfig();

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  if (config.mcpServers[name]) {
    throw new Error(`Server "${name}" already exists`);
  }

  const serverConfig: MCPServer = { command };
  if (args && args.length > 0) {
    serverConfig.args = args;
  }
  if (env && Object.keys(env).length > 0) {
    serverConfig.env = env;
  }

  config.mcpServers[name] = serverConfig;
  writeMcpConfig(config);
  console.log(`[MCPTester] Added server: ${name}`);
}

/**
 * Remove an MCP server from config
 */
export async function removeMCPServer(name: string): Promise<void> {
  const config = readMcpConfig();

  if (!config.mcpServers?.[name]) {
    throw new Error(`Server "${name}" not found`);
  }

  delete config.mcpServers[name];
  writeMcpConfig(config);
  console.log(`[MCPTester] Removed server: ${name}`);
}

/**
 * Update an existing MCP server config
 */
export async function updateMCPServer(
  name: string,
  updates: Partial<MCPServer>
): Promise<void> {
  const config = readMcpConfig();

  if (!config.mcpServers?.[name]) {
    throw new Error(`Server "${name}" not found`);
  }

  config.mcpServers[name] = {
    ...config.mcpServers[name],
    ...updates,
  };

  writeMcpConfig(config);
  console.log(`[MCPTester] Updated server: ${name}`);
}
