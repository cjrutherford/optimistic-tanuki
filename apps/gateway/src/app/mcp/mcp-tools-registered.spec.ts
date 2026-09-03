import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { McpRegistryDiscoveryService } from '@rekog/mcp-nest';
import { ProjectPlanningMcpToolsModule } from './mcp-tools.module';

/**
 * The tools have to be reachable, not merely written.
 *
 * Every tool in this folder existed, was decorated, and was provided, and the
 * server still came up advertising no capabilities: discovery walks the
 * subtree of whichever module imports McpModule.forRoot, and no tool lived
 * there. tools/list answered "Method not found", so an agent could never call
 * one. Nothing failed, nothing logged an error, and every unit test passed,
 * because each tool works perfectly when called directly.
 *
 * This boots the module and asks the registry what it found, which is the one
 * question that would have caught it.
 */
describe('the MCP server registers the tools it owns', () => {
  async function registeredToolNames(): Promise<string[]> {
    // ConfigModule is global in the running app; the module under test does
    // not import it itself, so the test supplies it.
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              auth: { jwtSecret: 'test-secret' },
              services: {
                project_planning: { host: 'localhost', port: 1 },
                telos_docs_service: { host: 'localhost', port: 1 },
              },
            }),
          ],
        }),
        ProjectPlanningMcpToolsModule,
      ],
    }).compile();

    // Discovery runs on bootstrap rather than on compile.
    await moduleRef.init();

    const discovery = moduleRef.get(McpRegistryDiscoveryService, {
      strict: false,
    });
    // One server here, so every module id it knows about is this one.
    const names = discovery
      .getMcpModuleIds()
      .flatMap((id) => discovery.getTools(id))
      .map((tool) => tool.metadata?.name)
      .filter((name): name is string => !!name);

    await moduleRef.close();
    return names;
  }

  it('exposes the tools an agent needs to do project work', async () => {
    const names = await registeredToolNames();

    // Not an exhaustive list on purpose. These are the ones the agent path
    // depends on, and an empty registry is the failure being guarded against.
    expect(names).toEqual(
      expect.arrayContaining([
        'list_projects',
        'create_task',
        'update_task',
        'create_risk',
        'create_journal_entry',
      ])
    );
  }, 30000);
});
