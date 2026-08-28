import { Test, TestingModule } from '@nestjs/testing';
import { ToolsService } from './tools.service';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Mock the SDK modules
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue({ tools: [] }),
      callTool: jest.fn().mockResolvedValue({}),
      listResources: jest.fn().mockResolvedValue({ resources: [] }),
      subscribeResource: jest.fn().mockResolvedValue({}),
    })),
  };
});

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => {
  return {
    StreamableHTTPClientTransport: jest.fn().mockImplementation(() => ({
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('ToolsService', () => {
  let service: ToolsService;
  let configService: ConfigService;
  let mockClientInstance: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://mock-gateway'),
          },
        },
      ],
    }).compile();

    service = module.get<ToolsService>(ToolsService);
    configService = module.get<ConfigService>(ConfigService);

    // Get the mock instance of Client created in the constructor/connect
    // Note: connect is called in onModuleInit, so we need to access it after init or spy on it
    // But Client is new'd up inside connect().
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Startup used to connect as nobody.
   *
   * The MCP surface is authenticated-only and there is no user at boot, so
   * that connection was refused ten times and logged an error on every start,
   * and no agent could ever call a tool through it.
   */
  describe('initialization', () => {
    it('does not connect at boot, since there is nobody to connect as', async () => {
      await service.onModuleInit();

      expect(Client).not.toHaveBeenCalled();
      expect(StreamableHTTPClientTransport).not.toHaveBeenCalled();
    });
  });

  describe('a session, which acts as one caller', () => {
    it("carries that caller's token", async () => {
      await service.session('a-real-token');

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
        new URL('http://mock-gateway'),
        {
          requestInit: {
            headers: { Authorization: 'Bearer a-real-token' },
          },
        }
      );
    });

    it('refuses to open without one', async () => {
      // A session with no token can do nothing but produce a 401 later, at a
      // point where it looks like the tool call failed.
      await expect(service.session('')).rejects.toThrow(/token/);
      expect(Client).not.toHaveBeenCalled();
    });

    it("lists and calls tools through the caller's client", async () => {
      const session = await service.session('t');
      const client = (Client as unknown as jest.Mock).mock.results[0].value;
      client.listTools.mockResolvedValue({ tools: [{ name: 'create_task' }] });
      client.callTool.mockResolvedValue({ ok: true });

      expect(await session.listTools()).toEqual([{ name: 'create_task' }]);
      expect(await session.callTool('create_task', { title: 'x' })).toEqual({
        ok: true,
      });
      expect(client.callTool).toHaveBeenCalledWith({
        name: 'create_task',
        arguments: { title: 'x' },
      });
    });
  });

  describe('tools operations', () => {
    beforeEach(async () => {
      await service.session('t');
      mockClientInstance = (Client as unknown as jest.Mock).mock.results[0]
        .value;
      // The older methods share the connection the session established.
      (service as unknown as { client: unknown }).client = mockClientInstance;
    });

    it('should list tools', async () => {
      const mockTools = [{ name: 'test-tool' }];
      mockClientInstance.listTools.mockResolvedValue({ tools: mockTools });

      const tools = await service.listTools();
      expect(tools).toEqual(mockTools);
      expect(mockClientInstance.listTools).toHaveBeenCalled();
    });

    it('should call tool', async () => {
      const mockResult = { result: 'success' };
      mockClientInstance.callTool.mockResolvedValue(mockResult);

      const result = await service.callTool('test-tool', { arg: 'val' });
      expect(result).toEqual(mockResult);
      expect(mockClientInstance.callTool).toHaveBeenCalledWith({
        name: 'test-tool',
        arguments: { arg: 'val' },
      });
    });

    it('should list resources', async () => {
      const mockResources = [{ uri: 'test://resource' }];
      mockClientInstance.listResources.mockResolvedValue({
        resources: mockResources,
      });

      const resources = await service.listResources();
      expect(resources).toEqual(mockResources);
      expect(mockClientInstance.listResources).toHaveBeenCalled();
    });

    it('should get resource', async () => {
      const mockResource = { content: 'data' };
      mockClientInstance.subscribeResource.mockResolvedValue(mockResource);

      const result = await service.getResource('test://resource');
      expect(result).toEqual(mockResource);
      expect(mockClientInstance.subscribeResource).toHaveBeenCalledWith({
        uri: 'test://resource',
      });
    });
  });

  describe('error handling', () => {
    it('should throw error if client not connected', async () => {
      // Create new service instance without init
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ToolsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('http://mock-gateway'),
            },
          },
        ],
      }).compile();
      const uninitService = module.get<ToolsService>(ToolsService);

      await expect(uninitService.listTools()).rejects.toThrow(
        'MCP Client not connected'
      );
    });
  });
});
