import { Test } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { INestApplication } from '@nestjs/common';
import { defer, of } from 'rxjs';
import { AddressInfo } from 'node:net';
import { AccountExportDownloadController } from './account-export-download.controller';
import { AuthGuard } from '../../auth/auth.guard';

const JOB_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DOWNLOAD_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BODY = Buffer.from('0123456789abcdef');
const META = {
  downloadId: DOWNLOAD_ID,
  sizeBytes: BODY.length,
  sha256: 'a'.repeat(64),
  fileName: 'account-export.tar',
  mimeType: 'application/x-tar',
  expiresAt: '2026-10-24T00:00:00.000Z',
};

describe('AccountExportDownloadController HTTP regression proof', () => {
  let app: INestApplication;
  let baseUrl: string;
  let send: jest.Mock;
  let guard: { canActivate: jest.Mock };
  let scenario: (cmd: string, payload: any) => unknown;

  beforeAll(async () => {
    send = jest.fn((pattern, payload) =>
      defer(() => of(scenario(pattern.cmd, payload)))
    );
    guard = {
      canActivate: jest.fn((ctx) => {
        const req = ctx.switchToHttp().getRequest();
        req.user = req.fixtureUser;
        req.credential = req.fixtureCredential;
        return true;
      }),
    };
    const module = await Test.createTestingModule({
      controllers: [AccountExportDownloadController],
      providers: [
        {
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: { send } as unknown as ClientProxy,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(guard)
      .compile();
    app = module.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => {
      req.fixtureUser =
        req.headers['x-fixture-app'] === 'foreign'
          ? { userId: 'user-1', appId: 'foreign-app' }
          : { userId: 'user-1', appId: 'client-interface' };
      req.fixtureCredential = 'fixture-credential';
      next();
    });
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${
      (app.getHttpServer().address() as AddressInfo).port
    }`;
  });

  beforeEach(() => {
    send.mockClear();
    scenario = (cmd, payload) => {
      if (cmd === AuthCommands.OpenAccountExportDownload) return META;
      if (cmd === AuthCommands.ReadAccountExportDownload) {
        const bytes = BODY.subarray(
          payload.offset,
          payload.offset + payload.length
        );
        return {
          offset: payload.offset,
          bytesBase64: bytes.toString('base64'),
          eof: payload.offset + bytes.length === BODY.length,
        };
      }
      return { closed: true };
    };
  });

  afterAll(async () => app.close());

  const download = (headers: Record<string, string> = {}) =>
    fetch(`${baseUrl}/authentication/account-export/${JOB_ID}/download`, {
      headers,
    });
  const callsFor = (cmd: string) =>
    send.mock.calls.filter(([pattern]) => pattern.cmd === cmd);

  it('retains the real AuthGuard decorator while replacing only guard behavior', () => {
    expect(
      Reflect.getMetadata('__guards__', AccountExportDownloadController)
    ).toContain(AuthGuard);
    expect(guard.canActivate).toBeDefined();
  });

  it('streams exact binary bytes with safe download headers and closes the RPC handle', async () => {
    const response = await download();
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(BODY);
    expect(response.headers.get('content-type')).toMatch(/^application\/x-tar/);
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="account-export.tar"'
    );
    expect(response.headers.get('content-length')).toBe(String(BODY.length));
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(callsFor(AuthCommands.CloseAccountExportDownload)).toHaveLength(1);
  });

  it.each([
    ['closed', 'bytes=3-3', 3, 3],
    ['open-ended', 'bytes=5-', 5, 15],
    ['suffix', 'bytes=-4', 12, 15],
    ['clamped', 'bytes=12-999', 12, 15],
  ])('serves %s range over HTTP', async (_name, range, start, end) => {
    const response = await download({ Range: range as string });
    expect(response.status).toBe(206);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      BODY.subarray(start as number, (end as number) + 1)
    );
    expect(response.headers.get('content-range')).toBe(
      `bytes ${start}-${end}/${BODY.length}`
    );
    expect(response.headers.get('content-length')).toBe(
      String((end as number) - (start as number) + 1)
    );
  });

  it.each(['bytes=0-1,4-5', 'bytes=9007199254740992-'])(
    'rejects invalid ranges and closes opened RPC',
    async (range) => {
      const response = await download({ Range: range });
      expect(response.status).toBe(416);
      expect(response.headers.get('content-range')).toBe(
        `bytes */${BODY.length}`
      );
      expect(callsFor(AuthCommands.ReadAccountExportDownload)).toHaveLength(0);
      expect(callsFor(AuthCommands.CloseAccountExportDownload)).toHaveLength(1);
    }
  );

  it('denies a foreign app before opening an RPC download', async () => {
    const response = await download({ 'x-fixture-app': 'foreign' });
    expect(response.status).toBe(403);
    expect(callsFor(AuthCommands.OpenAccountExportDownload)).toHaveLength(0);
  });

  it.each([
    [
      'wrong offset',
      (payload: any) => ({
        offset: payload.offset + 1,
        bytesBase64: BODY.subarray(
          payload.offset,
          payload.offset + payload.length
        ).toString('base64'),
        eof: false,
      }),
    ],
    [
      'malformed base64',
      (payload: any) => ({
        offset: payload.offset,
        bytesBase64: '!!!!',
        eof: false,
      }),
    ],
  ])(
    'fails closed on %s without returning bytes',
    async (_name, responseChunk) => {
      scenario = (cmd, payload) =>
        cmd === AuthCommands.OpenAccountExportDownload
          ? META
          : cmd === AuthCommands.ReadAccountExportDownload
          ? (responseChunk as any)(payload)
          : {};
      const response = await download();
      expect(response.status).not.toBe(200);
      expect(await response.json()).toMatchObject({
        message: 'Invalid export chunk',
      });
      expect(response.headers.get('content-disposition')).toBeNull();
      expect(callsFor(AuthCommands.CloseAccountExportDownload)).toHaveLength(1);
    }
  );

  it('destroys an already streaming response after downstream revocation instead of returning a complete artifact', async () => {
    let reads = 0;
    scenario = (cmd, payload) => {
      if (cmd === AuthCommands.OpenAccountExportDownload)
        return { ...META, sizeBytes: 131072 };
      if (cmd === AuthCommands.ReadAccountExportDownload) {
        reads++;
        if (reads === 1)
          return {
            offset: 0,
            bytesBase64: Buffer.alloc(65536, 65).toString('base64'),
            eof: false,
          };
        throw new Error('revoked downstream');
      }
      return {};
    };
    await expect(
      (async () => {
        const response = await download();
        await response.arrayBuffer();
      })()
    ).rejects.toThrow();
    expect(reads).toBe(2);
    expect(callsFor(AuthCommands.CloseAccountExportDownload)).toHaveLength(1);
  });
});
