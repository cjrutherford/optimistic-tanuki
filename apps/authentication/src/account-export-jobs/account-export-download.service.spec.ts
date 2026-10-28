import { RpcException } from '@nestjs/microservices';
import {
  AccountExportArtifactStoreService,
  VerifiedArtifact,
} from '@optimistic-tanuki/storage';
import { Repository } from 'typeorm';
import { AppService } from '../app/app.service';
import { AccountExportJobEntity } from './entities/account-export-job.entity';
import { AccountExportDownloadService } from './account-export-download.service';

const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const JOB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ARTIFACT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TOKEN = 'private-session-token';
const bytes = Buffer.from('verified tar payload');

describe('AccountExportDownloadService', () => {
  let service: AccountExportDownloadService;
  let job: AccountExportJobEntity;
  let auth: jest.Mocked<Pick<AppService, 'validateToken'>>;
  let store: jest.Mocked<
    Pick<AccountExportArtifactStoreService, 'openVerified'>
  >;
  let handle: jest.Mocked<VerifiedArtifact>;
  let jobs: jest.Mocked<Pick<Repository<AccountExportJobEntity>, 'findOne'>>;
  let request: Record<string, unknown>;

  beforeEach(() => {
    job = {
      id: JOB,
      accountId: ACCOUNT,
      appId: 'client-interface',
      kind: 'export',
      attempt: 3,
      state: 'complete',
      coverageSummary: {},
    } as AccountExportJobEntity;
    job.coverageSummary = {
      artifactState: 'verified',
      artifactAvailable: true,
      captureCoverage: { complete: true },
      privateArtifact: {
        artifactId: ARTIFACT,
        jobId: JOB,
        accountId: ACCOUNT,
        appId: 'client-interface',
        attempt: 3,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        sizeBytes: bytes.length,
        sha256: 'a'.repeat(64),
        frameCount: 1,
        framingVersion: 1,
      },
    };
    handle = {
      sizeBytes: bytes.length,
      readChunk: jest.fn(async (offset, length) =>
        bytes.subarray(offset, offset + length)
      ),
      cleanup: jest.fn(async () => undefined),
      createReadStream: jest.fn(),
    };
    auth = {
      validateToken: jest.fn(async () => ({
        isValid: true,
        data: { userId: ACCOUNT, appId: 'client-interface' },
      })),
    } as never;
    store = { openVerified: jest.fn(async () => handle) } as never;
    jobs = { findOne: jest.fn(async () => job) } as never;
    service = new AccountExportDownloadService(
      jobs as never,
      store as never,
      auth as never
    );
    request = {
      accountId: ACCOUNT,
      appId: 'client-interface',
      token: TOKEN,
      jobId: JOB,
    };
  });

  it('opens verified artifacts, reads bounded chunks, and closes the verified handle', async () => {
    const opened = await service.open(request);
    expect(opened).toMatchObject({
      fileName: 'account-export.tar',
      mimeType: 'application/x-tar',
      sizeBytes: bytes.length,
    });
    expect(store.openVerified).toHaveBeenCalledTimes(1);
    expect(
      await service.read({
        ...request,
        downloadId: opened.downloadId,
        offset: 0,
        length: bytes.length,
      })
    ).toEqual({ bytesBase64: bytes.toString('base64'), offset: 0, eof: true });
    await service.close({ ...request, downloadId: opened.downloadId });
    expect(handle.cleanup).toHaveBeenCalledTimes(1);
  });

  it('denies foreign sessions and revoked tokens on every read without returning bytes', async () => {
    const opened = await service.open(request);
    await expect(
      service.read({
        ...request,
        token: 'other-token',
        downloadId: opened.downloadId,
        offset: 0,
        length: 1,
      })
    ).rejects.toBeInstanceOf(RpcException);
    auth.validateToken.mockRejectedValueOnce(new Error('revoked'));
    await expect(
      service.read({
        ...request,
        downloadId: opened.downloadId,
        offset: 0,
        length: 1,
      })
    ).rejects.toBeInstanceOf(RpcException);
    expect(handle.cleanup).toHaveBeenCalledTimes(1);
  });

  it('rejects wrong user/app and incomplete or stale private artifact context', async () => {
    auth.validateToken.mockResolvedValueOnce({
      isValid: true,
      data: { userId: JOB, appId: 'client-interface' },
    } as never);
    await expect(service.open(request)).rejects.toBeInstanceOf(RpcException);
    job.coverageSummary['captureCoverage'] = { complete: false };
    await expect(service.open(request)).rejects.toBeInstanceOf(RpcException);
    expect(store.openVerified).not.toHaveBeenCalled();
  });

  it('rejects out of range reads and validates application scope', async () => {
    const opened = await service.open(request);
    await expect(
      service.read({
        ...request,
        downloadId: opened.downloadId,
        offset: bytes.length,
        length: 1,
      })
    ).rejects.toBeInstanceOf(RpcException);
    await expect(
      service.open({ ...request, appId: 'unknown-app' })
    ).rejects.toBeInstanceOf(RpcException);
  });

  it('limits capabilities per account and in the process', async () => {
    const first = await service.open(request);
    await service.open({ ...request, token: 'second-session' });
    await expect(
      service.open({ ...request, token: 'third-session' })
    ).rejects.toBeInstanceOf(RpcException);
    await service.close({ ...request, downloadId: first.downloadId });
  });

  it('expires and cleans capabilities during the bounded sweep and module shutdown', async () => {
    const opened = await service.open(request);
    const cap = (
      service as unknown as {
        capabilities: Map<string, { expiresAtMs: number }>;
      }
    ).capabilities.get(opened.downloadId)!;
    cap.expiresAtMs = Date.now() - 1;
    await (service as unknown as { sweep: () => Promise<void> }).sweep();
    expect(handle.cleanup).toHaveBeenCalledTimes(1);
    await service.onModuleDestroy();
  });

  it('reserves capacity before asynchronous verification so concurrent opens cannot exceed the account limit', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    store.openVerified.mockImplementation(async () => {
      await pending;
      return handle;
    });
    const first = service.open(request);
    const second = service.open(request);
    // Let both requests reserve their slots before starting a third.
    for (let i = 0; i < 8; i++) await Promise.resolve();
    await expect(service.open(request)).rejects.toBeInstanceOf(RpcException);
    expect(store.openVerified).toHaveBeenCalledTimes(2);
    release();
    await Promise.all([first, second]);
    await service.onModuleDestroy();
  });

  it('rechecks the session after slow verification before returning a capability', async () => {
    store.openVerified.mockImplementationOnce(async () => {
      auth.validateToken.mockResolvedValue({ isValid: false } as never);
      return handle;
    });
    await expect(service.open(request)).rejects.toBeInstanceOf(RpcException);
    expect(handle.cleanup).toHaveBeenCalledTimes(1);
  });

  it('retains a failed close for the expiry sweep to retry instead of dropping custody', async () => {
    const opened = await service.open(request);
    handle.cleanup.mockRejectedValueOnce(new Error('private close fault'));
    await expect(
      service.close({ ...request, downloadId: opened.downloadId })
    ).rejects.toBeInstanceOf(RpcException);
    await (service as unknown as { sweep(): Promise<void> }).sweep();
    expect(handle.cleanup).toHaveBeenCalledTimes(2);
    await expect(
      service.read({
        ...request,
        downloadId: opened.downloadId,
        offset: 0,
        length: 1,
      })
    ).rejects.toBeInstanceOf(RpcException);
  });
  it('drains a pending read without returning bytes after account purge', async () => {
    const opened = await service.open(request);
    let release!: (value: Buffer) => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    (handle.readChunk as jest.Mock).mockImplementationOnce(async () => {
      entered();
      return new Promise<Buffer>((resolve) => {
        release = resolve;
      });
    });
    const read = service.read({
      ...request,
      downloadId: opened.downloadId,
      offset: 0,
      length: 1,
    });
    const denied = expect(read).rejects.toBeInstanceOf(RpcException);
    await started;
    const purge = (service as any).purgeAccount(ACCOUNT);
    release(Buffer.from('x'));
    await denied;
    await purge;
    expect(await (service as any).readbackAccount(ACCOUNT)).toBe(0);
    await expect(service.open(request)).rejects.toBeInstanceOf(RpcException);
  });
  it('retains a failed cleanup of an unpublished open for account retry', async () => {
    (auth.validateToken as jest.Mock)
      .mockResolvedValueOnce({
        isValid: true,
        data: { userId: ACCOUNT, appId: 'client-interface' },
      })
      .mockResolvedValueOnce({ isValid: false });
    (handle.cleanup as jest.Mock).mockRejectedValueOnce(Error('CLOSE_FAILED'));
    await expect(service.open(request)).rejects.toThrow();
    await (service as any).purgeAccount(ACCOUNT);
    expect(await (service as any).readbackAccount(ACCOUNT)).toBe(0);
    expect(handle.cleanup).toHaveBeenCalledTimes(2);
  });
});
