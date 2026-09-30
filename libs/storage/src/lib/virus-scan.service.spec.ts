import {
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as net from 'net';

import { VirusScanService } from './virus-scan.service';

const EICAR_TEST_STRING =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

type ClamServer = {
  port: number;
  requests: Buffer[];
  close: () => Promise<void>;
};

function startClamServer(
  response: string | null,
  pingResponse: string | null = null
): Promise<ClamServer> {
  return new Promise((resolve, reject) => {
    const requests: Buffer[] = [];
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('data', (chunk) => {
        requests.push(chunk);
        const accumulated = Buffer.concat(requests);
        if (
          pingResponse !== null &&
          accumulated.includes(Buffer.from('zPING\0', 'utf8'))
        ) {
          socket.end(pingResponse);
          return;
        }
        if (
          response !== null &&
          accumulated.includes(Buffer.from([0, 0, 0, 0]))
        ) {
          socket.end(response);
        }
      });
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => undefined);
    });

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as net.AddressInfo;
      resolve({
        port: address.port,
        requests,
        close: () =>
          new Promise((resolveClose) => {
            sockets.forEach((socket) => socket.destroy());
            server.close(() => resolveClose());
          }),
      });
    });
  });
}

async function reserveClosedPort(): Promise<number> {
  const server = await startClamServer(null);
  const port = server.port;
  await server.close();
  return port;
}

describe('VirusScanService', () => {
  let activeServer: ClamServer | null = null;

  afterEach(async () => {
    if (activeServer) {
      await activeServer.close();
      activeServer = null;
    }
  });

  describe('nest dependency injection', () => {
    it('resolves through the injector with no options provider (assets boot regression)', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [VirusScanService],
      }).compile();
      const service = moduleRef.get(VirusScanService);
      expect(service).toBeInstanceOf(VirusScanService);
      expect(service.isConfigured()).toBe(false);
      await moduleRef.close();
    });
  });

  describe('unconfigured', () => {
    const service = new VirusScanService({ env: {} });

    it('fails closed when no real scanner is configured', async () => {
      await expect(
        service.scanFile(Buffer.from('untrusted content'), 'document.pdf')
      ).rejects.toThrow(ServiceUnavailableException);
      await expect(
        service.scanFile(Buffer.from('untrusted content'), 'document.pdf')
      ).rejects.toThrow(
        'No virus scanner is configured; file processing is denied.'
      );
    });

    it('reports the scanner as unavailable', async () => {
      await expect(service.isAvailable()).resolves.toBe(false);
      expect(service.getScannerInfo()).toEqual({
        name: 'Unavailable',
        version: 'N/A',
        protocol: 'zINSTREAM',
      });
      expect(service.isConfigured()).toBe(false);
    });

    it('never resolves a clean verdict while unconfigured', async () => {
      await expect(
        service.scanFile(Buffer.from('harmless'), 'harmless.txt')
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('against a clamav daemon', () => {
    const scanWith = (
      service: VirusScanService,
      buffer: Buffer,
      filename = 'document.pdf'
    ): ReturnType<VirusScanService['scanFile']> =>
      service.scanFile(buffer, filename);

    it('streams the payload with the zINSTREAM framing and reports clean', async () => {
      activeServer = await startClamServer('stream: OK\n');
      const service = new VirusScanService({
        env: { CLAMAV_HOST: '127.0.0.1' },
        port: activeServer.port,
      });

      const result = await scanWith(
        service,
        Buffer.from('Form 1040 U.S. Individual Income Tax Return')
      );

      expect(result.isClean).toBe(true);
      expect(result.threats).toBeUndefined();
      expect(result.scanner).toBe('ClamAV-Daemon');
      expect(result.scanDate).toBeInstanceOf(Date);

      const request = Buffer.concat(activeServer.requests);
      expect(request.subarray(0, 10).toString('utf8')).toBe('zINSTREAM\0');
      expect(request.includes(Buffer.from([0, 0, 0, 0]))).toBe(true);
    });

    it('reads the port and the payload limit from the environment', async () => {
      activeServer = await startClamServer('stream: OK\n');
      const service = new VirusScanService({
        env: {
          CLAMAV_HOST: '127.0.0.1',
          CLAMAV_PORT: String(activeServer.port),
          VAULT_STORAGE_CLAMAV_MAX_SCAN_BYTES: '8',
        },
      });

      expect(service.getScannerInfo()).toEqual({
        name: 'ClamAV-Daemon',
        version: `127.0.0.1:${activeServer.port}`,
        protocol: 'zINSTREAM',
      });
      await expect(
        service.scanFile(Buffer.alloc(9), 'big.pdf')
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('chunks a large payload into framed writes', async () => {
      activeServer = await startClamServer('stream: OK\n');
      const service = new VirusScanService({
        env: { CLAMAV_HOST: '127.0.0.1' },
        port: activeServer.port,
        chunkSize: 8,
      });

      await service.scanFile(Buffer.alloc(32, 0x41), 'chunked.pdf');

      const request = Buffer.concat(activeServer.requests);
      expect(request.readUInt32BE(10)).toBe(8);
      expect(request.readUInt32BE(10 + 4 + 8)).toBe(8);
    });

    it('reports the signature and never claims clean for an infected payload', async () => {
      activeServer = await startClamServer(
        'stream: Eicar-Test-Signature FOUND\n'
      );
      const service = new VirusScanService({
        env: { CLAMAV_HOST: '127.0.0.1' },
        port: activeServer.port,
      });

      const result = await scanWith(
        service,
        Buffer.from(`Sample test payload ${EICAR_TEST_STRING}`),
        'infected.pdf'
      );

      expect(result.isClean).toBe(false);
      expect(result.threats).toEqual(['Eicar-Test-Signature']);
      expect(result.scanner).toBe('ClamAV-Daemon');
    });

    it.each([
      ['stream: OK\0', true],
      ['stream: Eicar-Test-Signature FOUND\0', false],
    ])('accepts the NUL framed response %s', async (response, isClean) => {
      activeServer = await startClamServer(response);
      const service = new VirusScanService({
        env: { CLAMAV_HOST: '127.0.0.1' },
        port: activeServer.port,
      });

      const result = await service.scanFile(
        Buffer.from('document'),
        'document.pdf'
      );

      expect(result.isClean).toBe(isClean);
    });

    it('reports the daemon as available when it answers a ping', async () => {
      activeServer = await startClamServer('stream: OK\n', 'PONG\n');
      const service = new VirusScanService({
        env: { CLAMAV_HOST: '127.0.0.1' },
        port: activeServer.port,
      });

      await expect(service.isAvailable()).resolves.toBe(true);
    });
  });

  describe('fails closed when the scan did not run', () => {
    it('denies the file when the daemon refuses the connection', async () => {
      const port = await reserveClosedPort();
      const service = new VirusScanService({
        env: { CLAMAV_HOST: '127.0.0.1' },
        port,
      });

      await expect(
        service.scanFile(Buffer.from('document'), 'document.pdf')
      ).rejects.toThrow(ServiceUnavailableException);
      await expect(
        service.scanFile(Buffer.from('document'), 'document.pdf')
      ).rejects.toThrow(
        'ClamAV service is unavailable; file processing is denied.'
      );
      await expect(service.isAvailable()).resolves.toBe(false);
    });

    it('denies the file when the socket times out', async () => {
      activeServer = await startClamServer(null);
      const service = new VirusScanService({
        env: { CLAMAV_HOST: '127.0.0.1' },
        port: activeServer.port,
        socketTimeoutMs: 25,
      });

      await expect(
        service.scanFile(Buffer.from('document'), 'document.pdf')
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('denies the file when the absolute deadline is exceeded', async () => {
      activeServer = await startClamServer(null);
      const service = new VirusScanService({
        env: { CLAMAV_HOST: '127.0.0.1' },
        port: activeServer.port,
        absoluteDeadlineMs: 25,
      });

      await expect(
        service.scanFile(Buffer.from('document'), 'document.pdf')
      ).rejects.toThrow(/deadline/i);
    });

    it('denies the file when the daemon response exceeds the limit', async () => {
      activeServer = await startClamServer('x'.repeat(64 * 1024 + 1));
      const service = new VirusScanService({
        env: { CLAMAV_HOST: '127.0.0.1' },
        port: activeServer.port,
      });

      await expect(
        service.scanFile(Buffer.from('document'), 'document.pdf')
      ).rejects.toThrow(/64 KiB limit/);
    });

    it.each([
      'unexpected response',
      'stream: OK\nstream: OK\n',
      'stream: Unknown status',
      'stream: Eicar-Test-Signature ERROR',
      'stream: OK EXTRA',
    ])(
      'denies the file for malformed or ambiguous response %s',
      async (response) => {
        activeServer = await startClamServer(response);
        const service = new VirusScanService({
          env: { CLAMAV_HOST: '127.0.0.1' },
          port: activeServer.port,
        });

        await expect(
          service.scanFile(Buffer.from('document'), 'document.pdf')
        ).rejects.toThrow(ServiceUnavailableException);
      }
    );

    it('denies a payload larger than the bounded scan buffer', async () => {
      const service = new VirusScanService({
        env: { CLAMAV_HOST: '127.0.0.1' },
        maxScanBytes: 16,
        socketFactory: () => {
          throw new Error('scan socket should not be opened');
        },
      });

      await expect(
        service.scanFile(Buffer.alloc(17), 'oversized.pdf')
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('denies a lazy payload that was never materialized', async () => {
      const service = new VirusScanService({
        env: { CLAMAV_HOST: '127.0.0.1' },
        socketFactory: () => {
          throw new Error('scan socket should not be opened');
        },
      });

      await expect(
        service.scanFile('/etc/passwd' as unknown as Buffer, 'passwd.txt')
      ).rejects.toThrow('requires the file bytes');
    });
  });
});
