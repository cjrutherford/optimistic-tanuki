import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { McpRegistryDiscoveryService } from '@rekog/mcp-nest';
import { VaultMcpToolsModule } from './vault-mcp-tools.module';

/**
 * The vault tools have to be reachable, not merely written.
 *
 * A tool that exists, is decorated, and is provided is still uncallable if it
 * was never handed to `McpModule.forFeature`, and the failure is silent: the
 * server comes up advertising whatever else it owns, `tools/list` answers for
 * the rest, and the vault is simply absent. That is what happened to the first
 * batch of tools in this workspace, and every unit test passed through it.
 *
 * So this boots the module and asks the registry what it found.
 */
describe('the MCP server registers the vault tools it owns', () => {
  async function registeredToolNames(): Promise<string[]> {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              auth: { jwtSecret: 'test-secret' },
              services: {
                finance: { host: 'localhost', port: 3016 },
                compliance_audit: { host: 'localhost', port: 3025 },
              },
              vault: {
                ollama: { baseUrl: 'http://127.0.0.1:11434' },
                model: { name: 'qwen2.5-coder:14b' },
              },
            }),
          ],
        }),
        VaultMcpToolsModule,
      ],
    }).compile();

    await moduleRef.init();

    const discovery = moduleRef.get(McpRegistryDiscoveryService, {
      strict: false,
    });
    const names = discovery
      .getMcpModuleIds()
      .flatMap((id) => discovery.getTools(id))
      .map((tool) => tool.metadata?.name)
      .filter((name): name is string => !!name);

    await moduleRef.close();
    return names;
  }

  it('exposes a read, two parsers, and the one route to the local model', async () => {
    const names = await registeredToolNames();

    expect(names).toEqual(
      expect.arrayContaining([
        'vault_search_documents',
        'vault_parse_transcript',
        'vault_parse_tax_schedule',
        'vault_generate',
      ])
    );
  }, 30000);

  it('does not put a tenant on any tool, because the session supplies it', async () => {
    const names = await registeredToolNames();

    // Nothing here should be able to read another tenant's documents by
    // naming them, so no tool takes a tenantId at all.
    expect(names.filter((name) => name.startsWith('vault_'))).toHaveLength(4);
  }, 30000);
});
