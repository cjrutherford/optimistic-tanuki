import { Injectable, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ToolsService {
  private readonly l = new Logger(ToolsService.name);
  // default to gateway MCP path, can be overridden via config
  private readonly gatewayMcpBase: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {
    // look for a config value, fallback to the provided default
    this.gatewayMcpBase =
      this.config.get<string>('toolSources.gateway') ||
      'http://gateway:3000/mcp';
  }

  /**
   * Fetch list of tools from the gateway MCP proxy.
   * Expects the gateway to expose a GET /mcp/tools endpoint that returns an array of tool metadata.
   */
  async listTools(): Promise<any[]> {
    try {
      const url = `${this.gatewayMcpBase.replace(/\/$/, '')}`;
      this.l.log(`Listing tools from ${url}`);
      const resp = await lastValueFrom(
        this.http.post(
          url,
          {
            method: 'tools/list',
            id: 2,
            jsonrpc: '2.0',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json,text/event-stream',
            },
          }
        )
      );
      const toolsList = resp.data.result.tools;
      this.l.log(`Fetched ${toolsList.length} tools from gateway MCP`);
      // this.l.log('Tools ==> ' + JSON.stringify(toolsList, null, 2));
      return toolsList;
    } catch (err) {
      this.l.error('Error fetching tools list', err);
      throw err;
    }
  }

  /**
   * Execute a named tool via the gateway MCP proxy.
   * POST /mcp/tools/:toolName with JSON args (adjust path if your gateway expects a different route).
   */
  async callTool(
    toolName: string,
    args: Record<string, any> = {}
  ): Promise<any> {
    try {
      const url = `${this.gatewayMcpBase}`;
      this.l.log(
        `Calling tool ${toolName} at ${url} with args: ${JSON.stringify(args)}`
      );
      const resp = await lastValueFrom(
        this.http.post(
          url,
          {
            jsonrpc: '2.0',
            method: `tools/call`,
            id: 3,
            params: {
              name: toolName,
              arguments: args,
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json,text/event-stream',
            },
          }
        )
      );
      console.log(resp.data);
      return resp.data;
    } catch (err) {
      this.l.error(`Error calling tool ${toolName}`, err);
      throw err;
    }
  }
}
