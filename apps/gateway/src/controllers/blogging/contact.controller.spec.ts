import { Test, TestingModule } from '@nestjs/testing';
import { ContactController } from './contact.controller';
import {
  ContactCommands,
  LeadCommands,
  ProfileCommands,
  RoleCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
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
  let permissionsService: any;

  beforeEach(async () => {
    contactService = {
      send: jest.fn(),
    };
    leadService = {
      send: jest.fn(),
    };
    profileService = {
      send: jest.fn().mockReturnValue(
        of([
          {
            id: 'global-profile',
            email: 'global-profile@example.com',
            appScope: 'global',
          },
        ])
      ),
    };
    permissionsService = {
      send: jest.fn().mockReturnValue(
        of([
          {
            role: { name: 'owner_console_owner' },
            appScope: { name: 'owner-console' },
          },
        ])
      ),
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
          useValue: permissionsService,
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
        ownerNotificationRecipients: ['global-profile@example.com'],
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
      expect.objectContaining({ where: expect.any(Object) })
    );
  });

  it('resolves all owner emails from exact owner-console role assignments and deduplicates them', async () => {
    profileService.send.mockReturnValue(
      of([
        {
          id: 'bootstrap-global-profile',
          email: ' owner@example.com ',
          appScope: 'global',
        },
        {
          id: 'second-owner-profile',
          email: 'OWNER@example.com',
          appScope: 'global',
        },
        {
          id: 'wrong-scope-profile',
          email: 'wrong@example.com',
          appScope: 'hai',
        },
      ])
    );
    permissionsService.send.mockImplementation((_command, payload) => {
      if (payload.profileId === 'bootstrap-global-profile') {
        return of([
          {
            role: { name: 'owner_console_owner' },
            appScope: { name: 'owner-console' },
          },
        ]);
      }
      if (payload.profileId === 'second-owner-profile') {
        return of([
          {
            role: { name: 'system_admin' },
            appScope: { name: 'owner-console' },
          },
        ]);
      }
      return of([
        {
          role: { name: 'owner' },
          appScope: { name: 'global' },
        },
      ]);
    });
    leadService.send.mockReturnValue(of({ id: 'lead-1' }));

    await controller.createContact({
      name: 'Test',
      email: 'test@example.com',
      message: 'This is a valid lead message.',
      appScope: 'hai',
    } as any);

    expect(leadService.send).toHaveBeenCalledWith(
      { cmd: LeadCommands.CREATE },
      expect.objectContaining({
        ownerNotificationRecipients: ['owner@example.com'],
      })
    );
    expect(permissionsService.send).toHaveBeenCalledTimes(3);
    expect(permissionsService.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.GetUserRoles },
      {
        profileId: 'bootstrap-global-profile',
        appScope: 'owner-console',
      }
    );
  });

  it('fails HAI intake before creating a lead when there are no eligible owner recipients', async () => {
    profileService.send.mockReturnValue(
      of([
        {
          id: 'global-profile',
          email: 'owner@example.com',
          appScope: 'global',
        },
      ])
    );
    permissionsService.send.mockReturnValue(
      of([
        {
          role: { name: 'owner' },
          appScope: { name: 'global' },
        },
      ])
    );

    await expect(
      controller.createContact({
        name: 'Test',
        email: 'test@example.com',
        message: 'This is a valid lead message.',
        appScope: 'hai',
      } as any)
    ).rejects.toMatchObject({ status: 503 });
    expect(leadService.send).not.toHaveBeenCalled();
  });

  it('fails HAI intake before create when owner role lookup is unavailable', async () => {
    profileService.send.mockReturnValue(
      of([
        {
          id: 'global-profile',
          email: 'owner@example.com',
          appScope: 'global',
        },
      ])
    );
    permissionsService.send.mockReturnValue(
      throwError(() => new Error('permissions unavailable'))
    );

    await expect(
      controller.createContact({
        name: 'Test',
        email: 'test@example.com',
        message: 'This is a valid lead message.',
        appScope: 'hai',
      } as any)
    ).rejects.toMatchObject({ status: 503 });
    expect(leadService.send).not.toHaveBeenCalled();
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
