import { NotFoundException } from '@nestjs/common';
import { RegistryController } from './registry.controller';

describe('RegistryController', () => {
  let controller: RegistryController;

  beforeEach(() => {
    controller = new RegistryController();
  });

  it('returns the bundled application registry response', () => {
    const response = controller.getApps();

    expect(response.success).toBe(true);
    expect(response.data.apps.map((app) => app.appId)).toContain('hai');
    expect(response.data.apps.map((app) => app.appId)).toContain(
      'system-configurator'
    );
  });

  it('returns a single registered app by id', () => {
    const response = controller.getApp('system-configurator');

    expect(response.success).toBe(true);
    expect(response.data.appId).toBe('system-configurator');
  });

  it('throws not found for unknown apps', () => {
    expect(() => controller.getApp('missing-app')).toThrow(NotFoundException);
  });
});
