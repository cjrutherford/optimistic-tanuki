import { Test, TestingModule } from '@nestjs/testing';
import { ContactController } from './contact.controller';
import {
  ContactCommands,
  LeadCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { Logger } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';
import { ConfigService } from '@nestjs/config';

describe('ContactController', () => {
  let controller: ContactController;
  let contactService: any;
  let leadService: any;
  let profileService: any;

  beforeEach(async () => {
    contactService = {
      send: jest.fn(),
    };
    leadService = {
      send: jest.fn(),
    };
    profileService = {
      send: jest.fn().mockReturnValue(of([{ id: 'global-profile' }])),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [
        {
          provide: ServiceTokens.BLOG_SERVICE,
          useValue: contactService,
        },
        {
          provide: ServiceTokens.LEAD_SERVICE,
          useValue: leadService,
        },
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: profileService,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              appScopes: {
                hai: { sourceLabel: 'HAI' },
              },
            }),
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
    const dto: any = {
      name: 'Test',
      email: 'test@example.com',
      subject: 'General',
      message: 'This is a valid lead message.',
      appScope: 'hai',
    };
    leadService.send.mockReturnValue(of({ id: 'lead-1' }));

    await controller.createContact(dto);

    expect(leadService.send).toHaveBeenCalledWith(
      { cmd: LeadCommands.CREATE },
      expect.objectContaining({
        context: expect.objectContaining({
          appScope: 'hai',
          profileId: 'global-profile',
        }),
        dto: expect.objectContaining({
          name: 'Test',
          contactMessage: 'This is a valid lead message.',
        }),
      })
    );
    expect(profileService.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetAll },
      { where: { appScope: 'global' } }
    );
  });

  it('should ignore public identity and routing overrides', async () => {
    const dto: any = {
      name: 'Test',
      email: 'test@example.com',
      subject: 'General',
      message: 'This is a valid lead message.',
      appScope: 'hai',
      userId: 'spoof-user',
      profileId: 'spoof-profile',
      routingProfileId: 'spoof-routing-profile',
    };
    const user = {
      userId: 'authenticated-user',
      profileId: 'authenticated-profile',
    };
    leadService.send.mockReturnValue(of({ id: 'lead-1' }));

    await controller.createContact(dto, { user } as any);

    expect(leadService.send).toHaveBeenCalledWith(
      { cmd: LeadCommands.CREATE },
      expect.objectContaining({
        context: expect.objectContaining({
          userId: 'authenticated-user',
          profileId: 'global-profile',
        }),
        dto: expect.objectContaining({
          notes: expect.stringContaining(
            'Linked profile: authenticated-profile'
          ),
        }),
      })
    );
    expect(leadService.send).toHaveBeenCalledWith(
      { cmd: LeadCommands.CREATE },
      expect.objectContaining({
        dto: expect.objectContaining({
          notes: expect.not.stringContaining('spoof-profile'),
        }),
      })
    );
    expect(profileService.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetAll },
      { where: { appScope: 'global' } }
    );
  });

  it('attributes the lead to an anonymous placeholder when req.user is absent (anonymous or forged token)', async () => {
    const dto: any = {
      name: 'Test',
      email: 'test@example.com',
      subject: 'General',
      message: 'This is a valid lead message.',
      appScope: 'hai',
    };
    leadService.send.mockReturnValue(of({ id: 'lead-1' }));

    // No req at all (mirrors an anonymous submitter, or a caller whose
    // forged/invalid-signature token AuthGuard silently ignored on this
    // public route) — the lead must NOT be attributed to a forged identity.
    await controller.createContact(dto, undefined);

    expect(leadService.send).toHaveBeenCalledWith(
      { cmd: LeadCommands.CREATE },
      expect.objectContaining({
        context: expect.objectContaining({
          userId: 'public-contact:hai',
        }),
      })
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
