import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { EventSource } from 'eventsource';

// Polyfill EventSource for Node.js
global.EventSource = EventSource as any;

@Injectable()
export class ToolsService implements OnModuleInit, OnModuleDestroy {
  private readonly l = new Logger(ToolsService.name);
  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private readonly gatewayMcpUrl: string;

  constructor(private readonly config: ConfigService) {
    // Ensure this URL points to the SSE endpoint, e.g., http://gateway:3000/sse
    this.gatewayMcpUrl =
      this.config.get<string>('toolSources.gateway') ||
      'http://gateway:3000/api/mcp';
  }

  async onModuleInit() {
    this.connectWithRetry();
  }

  async onModuleDestroy() {
    if (this.transport) {
      await this.transport.close();
    }
  }

  private async connectWithRetry() {
    const maxRetries = 10;
    const retryDelay = 3000; // 3 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.connect();
        return; // Successfully connected
      } catch (err) {
        this.l.warn(
          `Failed to connect to MCP Server (Attempt ${attempt}/${maxRetries}). Retrying in ${retryDelay}ms...`
        );
        if (attempt === maxRetries) {
          this.l.error(
            'Max retries reached. Could not connect to MCP Server.',
            err
          );
        } else {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }
  }

  private async connect() {
    this.l.log(`Connecting to MCP Server at ${this.gatewayMcpUrl}`);

    this.transport = new StreamableHTTPClientTransport(
      new URL(this.gatewayMcpUrl)
    );

    this.client = new Client(
      {
        name: 'ai-orchestrator-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(this.transport);
    this.l.log('MCP Client connected successfully');
  }
  /**
   * Fetch list of tools using the SDK Client
   */
  async listTools(): Promise<Tool[]> {
    if (!this.client) {
      throw new Error('MCP Client not connected');
    }
    try {
      const result = await this.client.listTools();
      this.l.log(`Fetched ${result.tools.length} tools from gateway MCP`);
      return result.tools;
    } catch (err) {
      this.l.error('Error fetching tools list', err);
      throw err;
    }
  }

  /**
   * Execute a named tool using the SDK Client
   */
  async callTool(
    toolName: string,
    args: Record<string, any> = {}
  ): Promise<any> {
    if (!this.client) {
      throw new Error('MCP Client not connected');
    }
    try {
      this.l.log(`Calling tool ${toolName} with args: ${JSON.stringify(args)}`);

      const result = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      // The SDK returns a structured result.
      // We usually want to return the content to the LLM.
      return result;
    } catch (err) {
      this.l.error(`Error calling tool ${toolName}`, err);
      throw err;
    }
  }
}
