import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DirectoryPublicExportController } from './directory-public-export.controller';
import { IdentityThrottlerGuard } from '../learning/identity-throttler.guard';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

const TOWN = '00000000-0000-4000-8000-000000000001';

interface Sink {
  headers: Record<string, string>;
  setHeader(name: string, value: string): void;
}
const sink = (): Sink => {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
  };
};

describe('DirectoryPublicExportController', () => {
  const controller = new DirectoryPublicExportController();
  const env = { ...process.env };
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory.internal/';
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET = 's'.repeat(40);
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterAll(() => {
    process.env = env;
  });

  it('is public, throttled per caller, and has no permission guard', () => {
    const handler = DirectoryPublicExportController.prototype.download;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler);
    expect(guards).toEqual([IdentityThrottlerGuard]);
  });

  it('streams the Directory answer with attachment headers and no caching', async () => {
    fetchMock.mockResolvedValue(
      new Response('name\r\nA\r\n', {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="x.csv"',
          'x-row-count': '1',
          'x-export-truncated': 'false',
          'set-cookie': 'leak=1',
        },
      })
    );
    const res = sink();
    const file = await controller.download(TOWN, 'csv', res);
    expect(file).toBeDefined();
    expect(fetchMock.mock.calls[0][0]).toBe(
      `http://directory.internal/internal/public-export/${TOWN}?format=csv`
    );
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['x-row-count']).toBe('1');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('defaults to csv and rejects bad ids and formats without calling Directory', async () => {
    await expect(controller.download('nope', 'csv', sink())).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.download(TOWN, 'xlsx', sink())).rejects.toThrow(
      BadRequestException
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(new Response('x', { status: 200 }));
    await controller.download(TOWN, undefined, sink());
    expect(fetchMock.mock.calls[0][0]).toContain('format=csv');
  });

  it('maps Directory outcomes to safe errors', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));
    await expect(controller.download(TOWN, 'csv', sink())).rejects.toThrow(
      NotFoundException
    );
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(controller.download(TOWN, 'csv', sink())).rejects.toThrow(
      ServiceUnavailableException
    );
    fetchMock.mockRejectedValue(new Error('down'));
    await expect(controller.download(TOWN, 'csv', sink())).rejects.toThrow(
      ServiceUnavailableException
    );
    delete process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    await expect(controller.download(TOWN, 'csv', sink())).rejects.toThrow(
      ServiceUnavailableException
    );
  });
});
