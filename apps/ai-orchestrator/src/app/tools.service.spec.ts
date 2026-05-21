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

  describe('initialization', () => {
    it('should connect to MCP server on module init', async () => {
      await service.onModuleInit();
      expect(Client).toHaveBeenCalled();
      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(new URL('http://mock-gateway'));
    });
  });

  describe('tools operations', () => {
    beforeEach(async () => {
      // Initialize service to set up client
      await service.onModuleInit();
      // Get the instance created - use results because we returned a custom object
      mockClientInstance = (Client as unknown as jest.Mock).mock.results[0].value;
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
      mockClientInstance.listResources.mockResolvedValue({ resources: mockResources });

      const resources = await service.listResources();
      expect(resources).toEqual(mockResources);
      expect(mockClientInstance.listResources).toHaveBeenCalled();
    });

    it('should get resource', async () => {
      const mockResource = { content: 'data' };
      mockClientInstance.subscribeResource.mockResolvedValue(mockResource);

      const result = await service.getResource('test://resource');
      expect(result).toEqual(mockResource);
      expect(mockClientInstance.subscribeResource).toHaveBeenCalledWith({ uri: 'test://resource' });
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

      await expect(uninitService.listTools()).rejects.toThrow('MCP Client not connected');
    });
  });
});
