import { isScopedAppConfiguration } from './scoped-app-configuration.contract';

describe('isScopedAppConfiguration', () => {
  it('accepts a response with all required scope identities', () => {
    expect(
      isScopedAppConfiguration({
        id: 'configuration-1',
        workspaceId: 'workspace-1',
        appInstanceId: 'app-1',
        appScope: 'configurable-client',
        revision: 1,
        release: { status: 'draft', history: [] },
      })
    ).toBe(true);
  });

  it.each([
    ['workspaceId', { workspaceId: '' }],
    ['appInstanceId', { appInstanceId: ' ' }],
    ['appScope', { appScope: undefined }],
    ['revision', { revision: '1' }],
    ['release status', { release: { status: 'released', history: [] } }],
    ['release history', { release: { status: 'draft', history: null } }],
  ])('rejects a response without a nonempty %s', (_field, override) => {
    expect(
      isScopedAppConfiguration({
        id: 'configuration-1',
        workspaceId: 'workspace-1',
        appInstanceId: 'app-1',
        appScope: 'configurable-client',
        revision: 1,
        release: { status: 'draft', history: [] },
        ...override,
      })
    ).toBe(false);
  });
});
