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
import { firstValueFrom } from 'rxjs';

// Polyfill EventSource for Node.js
global.EventSource = EventSource as any;

/**
 * What to say when something asks for tools without saying who is asking.
 *
 * The MCP surface is authenticated-only. There was a connection attempt at
 * startup that carried no token, so it was refused ten times on every boot and
 * left the client undefined; every one of these methods then failed with "MCP
 * Client not connected", which pointed at the network rather than at the
 * missing credential. Removing that attempt did not break these paths, it
 * stopped them pretending. They still cannot work, and now they say why.
 */
const NEEDS_A_SESSION =
  'MCP tools are reached per caller. Open one with session(token) using the ' +
  'token of whoever is asking; there is no shared unauthenticated client.';

@Injectable()
export class ToolsService implements OnModuleInit, OnModuleDestroy {
  private readonly l = new Logger(ToolsService.name);
  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private readonly gatewayMcpUrl: string;

  constructor(private readonly config: ConfigService) {
    // Prefer an explicit environment override `MCP_URL`, then config, then default.
    // This allows docker-compose to point the service at a separate MCP server.
    this.gatewayMcpUrl =
      this.config.get<string>('MCP_URL') ||
      this.config.get<string>('toolSources.gateway') ||
      'http://gateway:3000/api/mcp';
  }

  async onModuleInit() {
    // Deliberately does not connect.
    //
    // The MCP surface is authenticated-only, and there is no user at boot, so
    // this connected as nobody, got 401 ten times and logged an error on every
    // startup. Tools are reached through session(), which carries the caller's
    // token.
    this.l.log(`MCP tools will be reached per caller at ${this.gatewayMcpUrl}`);
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

  async listResources() {
    if (!this.client) {
      throw new Error(NEEDS_A_SESSION);
    }
    try {
      const result = await this.client.listResources();
      this.l.log(
        `Fetched ${result.resources.length} resources from gateway MCP`
      );
      return result.resources;
    } catch (err) {
      this.l.error('Error fetching resources list', err);
      throw err;
    }
  }

  async getResource(resourceName: string) {
    if (!this.client) {
      throw new Error(NEEDS_A_SESSION);
    }
    try {
      this.l.log(`Getting resource ${resourceName} from gateway MCP`);
      const result = await this.client.subscribeResource({ uri: resourceName });
      return result; // Adjust this line based on the actual structure of the result object
    } catch (err) {
      this.l.error(`Error getting resource ${resourceName}`, err);
      throw err;
    }
  }

  /**
   * Fetch list of tools using the SDK Client
   */
  async listTools(): Promise<Tool[]> {
    if (!this.client) {
      throw new Error(NEEDS_A_SESSION);
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
      throw new Error(NEEDS_A_SESSION);
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

  /**
   * An MCP client that acts as one person.
   *
   * The gateway derives who is asking from the token on the request, and every
   * tool decides what may be read or written from that. A shared connection
   * made once at boot has no one to be, which is why the agent could never
   * call a tool: it was refused before it started.
   *
   * A session is made per token and closed by the caller. Sessions are not
   * pooled: a token outlives a single call, but holding open connections keyed
   * by credential is a cache of other people's authority, and the connection
   * is cheap next to the model call it accompanies.
   */
  async session(token: string): Promise<McpSession> {
    if (!token) {
      throw new Error("An MCP session needs the caller's token");
    }

    const transport = new StreamableHTTPClientTransport(
      new URL(this.gatewayMcpUrl),
      { requestInit: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const client = new Client(
      { name: 'ai-orchestrator-agent', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    this.l.log('MCP session opened for one caller');

    return {
      listTools: async () => (await client.listTools()).tools,
      callTool: async (name: string, args: Record<string, unknown>) =>
        await client.callTool({ name, arguments: args }),
      close: async () => {
        try {
          await transport.close();
        } catch {
          // A session that will not close cleanly is not worth failing the
          // caller's work over; the work is already done by this point.
        }
      },
    };
  }
}

export interface McpSession {
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}
