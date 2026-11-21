import type { Request, Response } from 'express';
import { applyDirectoryNoStore } from './directory-no-store';

interface HeaderRecorder {
  setHeader: jest.Mock;
}

const run = (path: string): HeaderRecorder => {
  const response: HeaderRecorder = { setHeader: jest.fn() };
  const next = jest.fn();
  applyDirectoryNoStore(
    { path } as Request,
    response as unknown as Response,
    next
  );
  expect(next).toHaveBeenCalledTimes(1);
  return response;
};

describe('applyDirectoryNoStore', () => {
  it.each([
    '/api/directory',
    '/api/directory/towns/x/listing-suppressions',
    '/api/directory/towns/x/local-evaluation-listings',
  ])('marks %s no-store before guards run', (path) => {
    expect(run(path).setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store'
    );
  });

  it.each(['/api/directoryx', '/api/payments/business/x', '/directory/towns'])(
    'leaves %s alone',
    (path) => {
      expect(run(path).setHeader).not.toHaveBeenCalled();
    }
  );
});
