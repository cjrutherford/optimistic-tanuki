import { Test, TestingModule } from '@nestjs/testing';
import { EventController } from './event.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { Logger } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';

import { EventCommands } from '@optimistic-tanuki/constants';

describe('EventController', () => {
  let controller: EventController;
  let eventService: any;

  beforeEach(async () => {
    eventService = {
      send: jest.fn(),
      connect: jest.fn().mockResolvedValue(null),
      close: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventController],
      providers: [
        {
          provide: ServiceTokens.BLOG_SERVICE,
          useValue: eventService,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
        Reflector,
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of(true)),
          },
        },
        {
          provide: PermissionsCacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            invalidateProfile: jest.fn().mockResolvedValue(undefined),
            invalidateAppScope: jest.fn().mockResolvedValue(undefined),
            clear: jest.fn().mockResolvedValue(undefined),
            getStats: jest.fn().mockResolvedValue({}),
            cleanupExpired: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EventController>(EventController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create an event', async () => {
    const dto: any = { title: 'Test' };
    eventService.send.mockReturnValue(of(dto));
    await controller.createEvent(dto);
    expect(eventService.send).toHaveBeenCalledWith(
      { cmd: EventCommands.CREATE },
      dto
    );
  });

  it('should find all events', async () => {
    const query: any = {};
    eventService.send.mockReturnValue(of([]));
    await controller.findAllEvents(query);
    expect(eventService.send).toHaveBeenCalledWith(
      { cmd: EventCommands.FIND_ALL },
      query
    );
  });

  it('should get an event', async () => {
    eventService.send.mockReturnValue(of({ id: '1' }));
    await controller.getEvent('1');
    expect(eventService.send).toHaveBeenCalledWith(
      { cmd: EventCommands.FIND },
      '1'
    );
  });

  it('should update an event', async () => {
    const dto: any = { title: 'Updated' };
    eventService.send.mockReturnValue(of({ id: '1', ...dto }));
    await controller.updateEvent('1', dto);
    expect(eventService.send).toHaveBeenCalledWith(
      { cmd: EventCommands.UPDATE },
      { id: '1', updateEventDto: dto }
    );
  });

  it('should delete an event', async () => {
    eventService.send.mockReturnValue(of({}));
    await controller.deleteEvent('1');
    expect(eventService.send).toHaveBeenCalledWith(
      { cmd: EventCommands.DELETE },
      '1'
    );
  });
});
