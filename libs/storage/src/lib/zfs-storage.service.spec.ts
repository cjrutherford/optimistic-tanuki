import { tmpdir } from 'os';
import * as path from 'path';

import { ZfsCommandRunner, ZfsStorageService } from './zfs-storage.service';

function runner(handlers: Partial<Record<string, string | Error>>): {
  run: ZfsCommandRunner;
  calls: string[];
} {
  const calls: string[] = [];
  const run: ZfsCommandRunner = (command, args) => {
    calls.push([command, ...args].join(' '));
    const result = handlers[command];
    if (result === undefined) {
      return Promise.reject(new Error(`${command}: not found`));
    }
    if (result instanceof Error) {
      return Promise.reject(result);
    }
    return Promise.resolve(result);
  };
  return { run, calls };
}

describe('ZfsStorageService', () => {
  const target = path.join(tmpdir(), 'vault-pool', 'tax');

  describe('when zfs is not present', () => {
    it('reports the real filesystem and claims no dataset or snapshot', async () => {
      const { run, calls } = runner({
        stat: 'ext4\n',
        df: 'Filesystem Type 1024-blocks Used Available Capacity Mounted on\n/dev/sda1 ext4 100 50 50 50% /srv/vault\n',
      });
      const service = new ZfsStorageService(run, {});

      const report = await service.detect(target);

      expect(report.isZfs).toBe(false);
      expect(report.filesystemType).toBe('ext4');
      expect(report.dataset).toBeNull();
      expect(report.pool).toBeNull();
      expect(report.mountPoint).toBeNull();
      expect(report.snapshotCapable).toBe(false);
      expect(report.snapshotsTaken).toBe(0);
      expect(report.datasetEnumerationFailed).toBe(true);
      expect(report.detail).toMatch(/ZFS is not in use/);
      expect(report.detail).toMatch(/ext4/);
      expect(report.detail).toMatch(/No dataset and no snapshot are claimed/);
      expect(calls).toContain('zfs list -H -o name,mountpoint');
    });

    it('falls back to df when stat is unavailable', async () => {
      const { run } = runner({
        df: 'Filesystem Type 1024-blocks Used Available Capacity Mounted on\n/dev/mapper/vg-vault xfs 100 50 50 50% /srv/vault\n',
      });
      const service = new ZfsStorageService(run, {});

      const report = await service.detect(target);

      expect(report.filesystemType).toBe('xfs');
      expect(report.isZfs).toBe(false);
      expect(report.detail).toMatch(/xfs/);
    });

    it('reports an unknown filesystem when every probe fails', async () => {
      const { run } = runner({});
      const service = new ZfsStorageService(run, {});

      const report = await service.detect(target);

      expect(report.isZfs).toBe(false);
      expect(report.filesystemType).toBeNull();
      expect(report.detection).toBe('unavailable');
      expect(report.detail).toMatch(/filesystem type is unknown/);
    });

    it('does not pretend an ext4 mount is a zfs dataset', async () => {
      const { run } = runner({
        zfs: 'tank\n\t/var/lib/zfs\n',
        stat: 'ext4\n',
      });
      const service = new ZfsStorageService(run, {});

      const report = await service.detect(
        path.join('/var/lib/zfs', 'elsewhere')
      );

      expect(report.isZfs).toBe(false);
      expect(report.dataset).toBeNull();
      expect(report.snapshotCapable).toBe(false);
    });
  });

  describe('when zfs is present', () => {
    const datasets = [
      'tank\t/\n',
      'tank/vault\t/srv/vault\n',
      'tank/vault/tax\t/srv/vault/tax\n',
    ].join('');

    it('resolves the deepest enclosing dataset and pool', async () => {
      const { run } = runner({ zfs: datasets, stat: 'zfs\n' });
      const service = new ZfsStorageService(run, {});

      const report = await service.detect(
        path.join('/srv/vault', 'tax', '1040')
      );

      expect(report.isZfs).toBe(true);
      expect(report.dataset).toBe('tank/vault/tax');
      expect(report.pool).toBe('tank');
      expect(report.mountPoint).toBe('/srv/vault/tax');
      expect(report.snapshotCapable).toBe(true);
      expect(report.snapshotsTaken).toBe(0);
      expect(report.detection).toBe('zfs-list');
      expect(report.detail).toMatch(/No snapshot was created by this write/);
    });

    it('does not claim a dataset when no mountpoint encloses the target', async () => {
      const { run } = runner({
        zfs: 'tank/vault\t/srv/vault\n',
        stat: 'zfs\n',
      });
      const service = new ZfsStorageService(run, {});

      const report = await service.detect('/srv/other/place');

      expect(report.isZfs).toBe(true);
      expect(report.dataset).toBeNull();
      expect(report.snapshotCapable).toBe(false);
      expect(report.detail).toMatch(/no ZFS dataset mountpoint encloses it/);
      expect(report.detail).toMatch(/No dataset or snapshot is claimed/);
    });

    it('attributes a path under the root dataset to the root dataset', async () => {
      const { run } = runner({ zfs: 'tank\t/\n', stat: 'zfs\n' });
      const service = new ZfsStorageService(run, {});

      const report = await service.detect('/mnt/other/place');

      expect(report.dataset).toBe('tank');
      expect(report.pool).toBe('tank');
      expect(report.snapshotCapable).toBe(true);
    });

    it('does not claim a dataset when the zfs enumeration itself failed', async () => {
      const { run } = runner({
        zfs: new Error('failed to open /dev/zfs: operation not permitted'),
        stat: 'zfs\n',
      });
      const service = new ZfsStorageService(run, {});

      const report = await service.detect('/srv/vault/tax');

      expect(report.isZfs).toBe(true);
      expect(report.datasetEnumerationFailed).toBe(true);
      expect(report.dataset).toBeNull();
      expect(report.snapshotCapable).toBe(false);
      expect(report.detail).toMatch(/the zfs list enumeration failed/);
    });

    it('never matches a mountpoint that is only a name prefix', async () => {
      const { run } = runner({
        zfs: 'tank/vault\t/srv/vault\n',
        stat: 'zfs\n',
      });
      const service = new ZfsStorageService(run, {});

      const report = await service.detect('/srv/vault-backup/tax');

      expect(report.dataset).toBeNull();
      expect(report.snapshotCapable).toBe(false);
    });
  });

  describe('VAULT_STORAGE_ZFS_REQUIRED', () => {
    it.each([
      ['1', true],
      ['true', true],
      ['TRUE', true],
      ['0', false],
      ['false', false],
      [undefined, false],
    ])('reads %s as required=%s', (value, expected) => {
      const service = new ZfsStorageService(runner({}).run, {
        ...(value === undefined ? {} : { VAULT_STORAGE_ZFS_REQUIRED: value }),
      });

      expect(service.isZfsRequired()).toBe(expected);
    });
  });
});
