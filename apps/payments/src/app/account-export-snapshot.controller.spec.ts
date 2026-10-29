jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {},
  AccountExportProfileSnapshotClient: class {},
  AccountExportOwnerSpoolService: class {},
  AccountExportProfileBoundSnapshotService: class {},
  AccountExportProfileBoundSnapshotError: class extends Error {},
}));

import { PaymentsAccountExportSnapshotController } from './account-export-snapshot.controller';

describe('PaymentsAccountExportSnapshotController', () => {
  it('forwards capture RPC operations to the snapshot service', async () => {
    const captures = { open: jest.fn(), read: jest.fn(), release: jest.fn() };
    const controller = new PaymentsAccountExportSnapshotController(
      captures as any
    );
    const input = { captureId: 'capture' };
    captures.open.mockResolvedValue('opened');
    captures.read.mockResolvedValue('read');
    captures.release.mockResolvedValue('released');
    await expect(controller.open(input)).resolves.toBe('opened');
    await expect(controller.read(input)).resolves.toBe('read');
    await expect(controller.release(input)).resolves.toBe('released');
    expect(captures.open).toHaveBeenCalledWith(input);
    expect(captures.read).toHaveBeenCalledWith(input);
    expect(captures.release).toHaveBeenCalledWith(input);
  });
});
