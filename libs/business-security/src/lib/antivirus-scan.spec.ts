import {
  BadRequestException,
  ExecutionContext,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter } from 'events';
import * as net from 'net';
import { of } from 'rxjs';
import {
  AntivirusScanInterceptor,
  AntivirusScanResult,
  EICAR_TEST_STRING,
} from './antivirus-scan.interceptor';

type InterceptorOptions = {
  host?: string;
  port?: number;
  socketTimeoutMs?: number;
  absoluteDeadlineMs?: number;
  maxScanBytes?: number;
  maxResponseBytes?: number;
  socketFactory?: () => net.Socket;
};

type InterceptorConstructor = new (
  options?: InterceptorOptions
) => AntivirusScanInterceptor;

type ClamServer = {
  port: number;
  requests: Buffer[];
  close: () => Promise<void>;
};

function createInterceptor(
  options: InterceptorOptions
): AntivirusScanInterceptor {
  const Constructor =
    AntivirusScanInterceptor as unknown as InterceptorConstructor;
  return new Constructor(options);
}

function startClamServer(response: string | null): Promise<ClamServer> {
  return new Promise((resolve, reject) => {
    const requests: Buffer[] = [];
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('data', (chunk) => {
        requests.push(chunk);
        if (
          response !== null &&
          Buffer.concat(requests).includes(Buffer.from([0, 0, 0, 0]))
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

class BackpressureSocket extends EventEmitter {
  readonly writes: Buffer[] = [];
  writesBeforeDrain = 0;

  setTimeout(_timeout: number): this {
    return this;
  }

  connect(_port: number, _host: string, callback: () => void): this {
    setImmediate(callback);
    return this;
  }

  write(data: string | Buffer): boolean {
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
    this.writes.push(chunk);
    if (this.writes.length === 1) {
      setImmediate(() => {
        this.writesBeforeDrain = this.writes.length;
        this.emit('drain');
      });
      return false;
    }
    if (chunk.length === 4 && chunk.every((byte) => byte === 0)) {
      setImmediate(() => {
        this.emit('data', Buffer.from('stream: OK\n'));
        this.emit('end');
      });
    }
    return true;
  }

  destroy(): this {
    return this;
  }
}

describe('AntivirusScanInterceptor', () => {
  let activeServer: ClamServer | null = null;

  afterEach(async () => {
    if (activeServer) {
      await activeServer.close();
      activeServer = null;
    }
  });

  it('streams a document through zINSTREAM and returns a clean result', async () => {
    activeServer = await startClamServer('stream: OK\n');
    const interceptor = createInterceptor({
      host: '127.0.0.1',
      port: activeServer.port,
    });

    const result = await interceptor.scanBuffer(
      Buffer.from('Standard IRS 1040 document payload'),
      'Form-1040.pdf'
    );

    expect(result).toEqual<Partial<AntivirusScanResult>>({
      clean: true,
      status: 'clean',
      engine: 'ClamAV-Daemon',
    });
    const request = Buffer.concat(activeServer.requests);
    expect(request.subarray(0, 10).toString('utf8')).toBe('zINSTREAM\0');
    expect(request.includes(Buffer.from([0, 0, 0, 0]))).toBe(true);
  });

  it('keeps infected results distinguishable from clean results', async () => {
    activeServer = await startClamServer(
      'stream: Eicar-Test-Signature FOUND\n'
    );
    const interceptor = createInterceptor({
      host: '127.0.0.1',
      port: activeServer.port,
    });

    const result = await interceptor.scanBuffer(
      Buffer.from(`Sample test payload ${EICAR_TEST_STRING}`),
      'infected.pdf'
    );

    expect(result.clean).toBe(false);
    expect(result.status).toBe('infected');
    expect(result.signature).toBe('Eicar-Test-Signature');
  });

  it.each([
    ['stream: OK\0', 'clean', true, undefined],
    [
      'stream: Eicar-Test-Signature FOUND\0',
      'infected',
      false,
      'Eicar-Test-Signature',
    ],
  ])(
    'accepts the NUL-framed z-command response %s',
    async (response, status, clean, signature) => {
      activeServer = await startClamServer(response);
      const interceptor = createInterceptor({
        host: '127.0.0.1',
        port: activeServer.port,
      });

      const result = await interceptor.scanBuffer(
        Buffer.from('document'),
        'document.pdf'
      );

      expect(result.status).toBe(status);
      expect(result.clean).toBe(clean);
      expect(result.signature).toBe(signature);
    }
  );

  it('rejects uploads larger than 25 MiB', async () => {
    const interceptor = createInterceptor({});

    await expect(
      interceptor.scanBuffer(
        Buffer.alloc(25 * 1024 * 1024 + 1),
        'oversized.bin'
      )
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it('rejects oversized encoded base64 before opening a scan socket', async () => {
    const socketFactory = jest.fn(() => {
      throw new Error('scan socket should not be opened');
    });
    const interceptor = createInterceptor({
      maxScanBytes: 5,
      socketFactory,
    });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          body: { fileBase64: '!'.repeat(100) },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(
      interceptor.intercept(context, { handle: () => of({ success: true }) })
    ).rejects.toThrow(PayloadTooLargeException);
    expect(socketFactory).not.toHaveBeenCalled();
  });

  it('rejects empty base64 before opening a scan socket', async () => {
    const socketFactory = jest.fn(() => {
      throw new Error('scan socket should not be opened');
    });
    const interceptor = createInterceptor({ socketFactory });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          body: { fileBase64: '' },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(
      interceptor.intercept(context, { handle: () => of({ success: true }) })
    ).rejects.toThrow(BadRequestException);
    expect(socketFactory).not.toHaveBeenCalled();
  });

  it('rejects ambiguous multipart and base64 uploads before scanning', async () => {
    const socketFactory = jest.fn(() => {
      throw new Error('scan socket should not be opened');
    });
    const interceptor = createInterceptor({ socketFactory });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          file: { buffer: Buffer.from('multipart document') },
          body: { fileBase64: 'not-base64' },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(
      interceptor.intercept(context, { handle: () => of({ success: true }) })
    ).rejects.toThrow(BadRequestException);
    expect(socketFactory).not.toHaveBeenCalled();
  });

  it('rejects malformed base64 before opening a scan socket', async () => {
    const socketFactory = jest.fn(() => {
      throw new Error('scan socket should not be opened');
    });
    const interceptor = createInterceptor({ socketFactory });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          body: { fileBase64: 'not-base64' },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(
      interceptor.intercept(context, { handle: () => of({ success: true }) })
    ).rejects.toThrow(BadRequestException);
    expect(socketFactory).not.toHaveBeenCalled();
  });

  it('rejects daemon responses larger than 64 KiB', async () => {
    activeServer = await startClamServer('x'.repeat(64 * 1024 + 1));
    const interceptor = createInterceptor({
      host: '127.0.0.1',
      port: activeServer.port,
    });

    await expect(
      interceptor.scanBuffer(Buffer.from('document'), 'document.pdf')
    ).rejects.toThrow(/response.*limit/i);
  });

  it('enforces an absolute deadline independently of socket timeout', async () => {
    activeServer = await startClamServer(null);
    const interceptor = createInterceptor({
      host: '127.0.0.1',
      port: activeServer.port,
      socketTimeoutMs: 1000,
      absoluteDeadlineMs: 25,
    });

    await expect(
      interceptor.scanBuffer(Buffer.from('document'), 'document.pdf')
    ).rejects.toThrow(/deadline/i);
  });

  it('waits for drain before writing subsequent payload chunks', async () => {
    const socket = new BackpressureSocket();
    const interceptor = createInterceptor({
      socketFactory: () => socket as unknown as net.Socket,
    });

    const result = await interceptor.scanBuffer(
      Buffer.from('payload'),
      'document.pdf'
    );

    expect(result.status).toBe('clean');
    expect(socket.writesBeforeDrain).toBe(1);
  });

  it('does not include user-controlled filenames in malware logs', async () => {
    activeServer = await startClamServer(
      'stream: Eicar-Test-Signature FOUND\n'
    );
    const interceptor = createInterceptor({
      host: '127.0.0.1',
      port: activeServer.port,
    });
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const request = {
      file: {
        buffer: Buffer.from('malicious'),
        originalname: 'secret-file\nname.txt',
      },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    await expect(
      interceptor.intercept(context, { handle: () => of({ success: true }) })
    ).rejects.toThrow(BadRequestException);
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('secret-file');
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('\n');
    warnSpy.mockRestore();
  });

  it('rejects a missing upload', async () => {
    const interceptor = createInterceptor({});
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ success: true }) };

    await expect(interceptor.intercept(context, next)).rejects.toThrow(
      BadRequestException
    );
  });

  it('rejects malware upload with BadRequestException during intercept', async () => {
    activeServer = await startClamServer(
      'stream: Eicar-Test-Signature FOUND\n'
    );
    const interceptor = createInterceptor({
      host: '127.0.0.1',
      port: activeServer.port,
    });
    const request = {
      file: {
        buffer: Buffer.from('Malicious data'),
        originalname: 'compromised.exe',
      },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ success: true }) };

    await expect(interceptor.intercept(context, next)).rejects.toThrow(
      BadRequestException
    );
  });

  it('permits a clean upload during intercept and sets antivirusStatus', async () => {
    activeServer = await startClamServer('stream: OK\n');
    const interceptor = createInterceptor({
      host: '127.0.0.1',
      port: activeServer.port,
    });
    const request = {
      file: {
        buffer: Buffer.from('Clean confidential legal brief'),
        originalname: 'Brief.docx',
      },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ success: true }) };

    const observable = await interceptor.intercept(context, next);
    const result = await new Promise((resolve) =>
      observable.subscribe(resolve)
    );
    expect(result).toEqual({ success: true });
    expect(request).toHaveProperty('antivirusStatus', 'clean');
  });

  it('fails closed when the ClamAV connection is refused', async () => {
    const port = await reserveClosedPort();
    const interceptor = createInterceptor({
      host: '127.0.0.1',
      port,
    });

    await expect(
      interceptor.scanBuffer(Buffer.from('document'), 'document.pdf')
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('fails closed when the ClamAV socket times out', async () => {
    activeServer = await startClamServer(null);
    const interceptor = createInterceptor({
      host: '127.0.0.1',
      port: activeServer.port,
      socketTimeoutMs: 25,
    });

    await expect(
      interceptor.scanBuffer(Buffer.from('document'), 'document.pdf')
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it.each([
    'unexpected response',
    'stream: OK\nstream: OK\n',
    'stream: Unknown status',
    'stream: Eicar-Test-Signature ERROR',
  ])(
    'fails closed for malformed or ambiguous response %s',
    async (response) => {
      activeServer = await startClamServer(response);
      const interceptor = createInterceptor({
        host: '127.0.0.1',
        port: activeServer.port,
      });

      await expect(
        interceptor.scanBuffer(Buffer.from('document'), 'document.pdf')
      ).rejects.toThrow(ServiceUnavailableException);
    }
  );
});
