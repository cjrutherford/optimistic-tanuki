import { Test, TestingModule } from '@nestjs/testing';
import { ContactController } from './contact.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { Logger } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';

import { ContactCommands } from '@optimistic-tanuki/constants';

describe('ContactController', () => {
  let controller: ContactController;
  let contactService: any;

  beforeEach(async () => {
    contactService = {
      send: jest.fn(),
      connect: jest.fn().mockResolvedValue(null),
      close: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [
        {
          provide: ServiceTokens.BLOG_SERVICE,
          useValue: contactService,
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

    controller = module.get<ContactController>(ContactController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a contact', async () => {
    const dto: any = { name: 'Test' };
    contactService.send.mockReturnValue(of({}));
    await controller.createContact(dto);
    expect(contactService.send).toHaveBeenCalledWith(
      { cmd: ContactCommands.CREATE },
      dto
    );
  });

  it('should find all contacts', async () => {
    const query: any = {};
    contactService.send.mockReturnValue(of([]));
    await controller.findAllContacts(query);
    expect(contactService.send).toHaveBeenCalledWith(
      { cmd: ContactCommands.FIND_ALL },
      query
    );
  });

  it('should get a contact', async () => {
    contactService.send.mockReturnValue(of({ id: '1' }));
    await controller.getContact('1');
    expect(contactService.send).toHaveBeenCalledWith(
      { cmd: ContactCommands.FIND },
      '1'
    );
  });

  it('should update a contact', async () => {
    const dto: any = { name: 'Updated' };
    contactService.send.mockReturnValue(of({ id: '1', ...dto }));
    await controller.updateContact('1', dto);
    expect(contactService.send).toHaveBeenCalledWith(
      { cmd: ContactCommands.UPDATE },
      { id: '1', updateContactDto: dto }
    );
  });

  it('should delete a contact', async () => {
    contactService.send.mockReturnValue(of({}));
    await controller.deleteContact('1');
    expect(contactService.send).toHaveBeenCalledWith(
      { cmd: ContactCommands.DELETE },
      '1'
    );
  });
});
