import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import type { UserDetails } from '../../decorators/user.decorator';
import { MAX_NOTE_LENGTH, SourcesController } from './sources.controller';

const reader = { userId: 'user-1' } as UserDetails;

function fixture(reply: (cmd: string, payload: unknown) => unknown) {
  const send = jest.fn((pattern: { cmd: string }, payload: unknown) => {
    const value = reply(pattern.cmd, payload);
    return value instanceof Error ? throwError(() => value) : of(value);
  });
  return { controller: new SourcesController({ send } as never), send };
}

describe('SourcesController', () => {
  it('serves the source status publicly', async () => {
    const status = {
      slug: 'adel-ga',
      name: 'Adel',
      status: 'no-sources',
      requestCount: 3,
    };
    const { controller, send } = fixture(() => status);
    expect(await controller.status('adel-ga')).toEqual(status);
    expect(send).toHaveBeenCalledWith(
      { cmd: CivicBriefingCommands.SOURCE_STATUS },
      { slug: 'adel-ga' }
    );
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, SourcesController.prototype.status)
    ).toBe(true);
  });

  it('answers 404 for an unknown town, on both routes', async () => {
    const { controller } = fixture(() => null);
    await expect(controller.status('nowhere')).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(
      controller.request('nowhere', {}, reader)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires a signed-in reader to request sources', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      SourcesController.prototype.request
    );
    expect(guards).toHaveLength(1);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, SourcesController.prototype.request)
    ).toBeUndefined();
  });

  it("records the reader's request with a trimmed note", async () => {
    const { controller, send } = fixture(() => ({
      requestCount: 1,
      alreadyRequested: false,
    }));
    expect(
      await controller.request('adel-ga', { note: '  please  ' }, reader)
    ).toEqual({ requestCount: 1, alreadyRequested: false });
    expect(send).toHaveBeenCalledWith(
      { cmd: CivicBriefingCommands.REQUEST_SOURCES },
      { slug: 'adel-ga', userId: 'user-1', note: 'please' }
    );
  });

  it('sends no note when it is blank or absent', async () => {
    const { controller, send } = fixture(() => ({
      requestCount: 1,
      alreadyRequested: true,
    }));
    await controller.request('adel-ga', { note: '   ' }, reader);
    await controller.request('adel-ga', {}, reader);
    expect(send).toHaveBeenNthCalledWith(1, expect.anything(), {
      slug: 'adel-ga',
      userId: 'user-1',
    });
    expect(send).toHaveBeenNthCalledWith(2, expect.anything(), {
      slug: 'adel-ga',
      userId: 'user-1',
    });
  });

  it('accepts a note of 500 characters and rejects a longer one with 400', async () => {
    const { controller, send } = fixture(() => ({
      requestCount: 1,
      alreadyRequested: false,
    }));
    await controller.request(
      'adel-ga',
      { note: ` ${'x'.repeat(MAX_NOTE_LENGTH)} ` },
      reader
    );
    expect(send).toHaveBeenCalledTimes(1);
    await expect(
      controller.request(
        'adel-ga',
        { note: 'x'.repeat(MAX_NOTE_LENGTH + 1) },
        reader
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('answers 503 when civic-briefing cannot be reached', async () => {
    const { controller } = fixture(() => new Error('ECONNREFUSED'));
    await expect(controller.status('adel-ga')).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
