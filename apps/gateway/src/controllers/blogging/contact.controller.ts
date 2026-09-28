import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Logger,
  ForbiddenException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  ContactCommands,
  LeadCommands,
  ProfileCommands,
  RoleCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  ContactQueryDto,
  CreateLeadDto,
  LeadSource,
  LeadStatus,
  PublicContactLeadIntakeDto,
  ProfileDto,
  SendLeadResponseDto,
  UpdateContactDto,
  UpdateLeadDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';

type ContactLeadRoutingEntry = {
  profileId?: string;
  sourceLabel?: string;
};

const OWNER_CONSOLE_SCOPE = 'owner-console';
const OWNER_CONSOLE_ROLE_NAMES = new Set([
  'owner_console_owner',
  'owner',
  'global_admin',
  'system_admin',
]);

type RoleAssignment = {
  role?: { name?: string };
  appScope?: { name?: string } | string | null;
};

type ContactLeadRoutingConfig = {
  defaultProfileId?: string;
  appScopes?: Record<string, ContactLeadRoutingEntry>;
};

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(
    @Inject(ServiceTokens.BLOG_SERVICE)
    private readonly contactService: ClientProxy,
    @Inject(ServiceTokens.LEAD_SERVICE)
    private readonly leadService: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileService: ClientProxy,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsService: ClientProxy,
    private readonly configService: ConfigService,
    private readonly l: Logger
  ) {
    this.l.log('ContactController initialized');
  }

  // Public so anonymous site visitors can submit a contact form, but
  // AuthGuard still runs to OPTIONALLY attach a signature-verified
  // `request.user` when a valid token is present. The lead is attributed to
  // that guard-verified identity — never to the raw `@User()` decode, which
  // does not verify the token's signature and would let a forged
  // userId/profileId attribute the submission to an arbitrary victim.
  @Public()
  @UseGuards(AuthGuard)
  @Post()
  async createContact(
    @Body() contactLead: PublicContactLeadIntakeDto,
    @Req() req?: { user?: { userId?: string; profileId?: string } }
  ) {
    try {
      if (contactLead.website?.trim()) {
        this.l.warn(
          `Honeypot contact submission ignored for ${contactLead.appScope}`
        );
        return {
          message: 'Contact submitted successfully',
          leadId: null,
        };
      }

      const routing = await this.resolveRouting(contactLead);
      const ownerNotificationRecipients =
        contactLead.appScope === 'hai'
          ? await this.resolveOwnerNotificationRecipients()
          : undefined;
      const linkedUserId =
        req?.user?.userId || `public-contact:${contactLead.appScope}`;
      const linkedProfileId = req?.user?.profileId || '';

      const createLeadDto: CreateLeadDto = {
        name: contactLead.name.trim(),
        company: contactLead.company?.trim() || undefined,
        email: contactLead.email.trim(),
        phone: contactLead.phone?.trim() || undefined,
        source: LeadSource.OTHER,
        status: LeadStatus.NEW,
        notes: this.buildLeadNotes(contactLead, linkedProfileId),
        isAutoDiscovered: false,
        searchKeywords: this.buildLeadKeywords(contactLead),
        contactSubject: contactLead.subject?.trim() || 'General inquiry',
        contactMessage: contactLead.message.trim(),
        contactSourceLabel:
          contactLead.sourceLabel ||
          routing.sourceLabel ||
          contactLead.appScope,
      };

      const lead = await firstValueFrom(
        this.leadService.send(
          { cmd: LeadCommands.CREATE },
          {
            dto: createLeadDto,
            context: {
              userId: linkedUserId,
              profileId: routing.profileId,
              appScope: contactLead.appScope,
            },
            ownerNotificationRecipients,
          }
        )
      );

      this.l.log(
        `Public contact intake stored as lead ${lead?.id ?? 'unknown'} for ${
          contactLead.appScope
        }`
      );

      return {
        message: 'Contact submitted successfully',
        leadId: lead?.id ?? null,
      };
    } catch (error) {
      this.l.error('Error creating public contact lead', error);
      throw new HttpException(
        `Failed to create contact: [${error.message}]`,
        error?.status || error?.statusCode || 500
      );
    }
  }

  @Get('leads')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('app-config.update')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'appScope', required: false })
  async findAllLeads(
    @User() user: UserDetails,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('appScope') appScope?: string
  ) {
    return firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.FIND_ALL },
        {
          profileId: user.profileId,
          status,
          source,
          appScope,
        }
      )
    );
  }

  @Get('leads/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('app-config.update')
  async getLead(@Param('id') id: string, @User() user: UserDetails) {
    const lead = await firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.FIND_ONE },
        { id, profileId: user.profileId }
      )
    );
    if (!lead) {
      throw new HttpException('Lead not found', 404);
    }
    return lead;
  }

  @Patch('leads/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('app-config.update')
  async updateLead(
    @Param('id') id: string,
    @Body() updateData: UpdateLeadDto,
    @User() user: UserDetails
  ) {
    const updatedLead = await firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.UPDATE },
        {
          id,
          dto: updateData,
          profileId: user.profileId,
        }
      )
    );
    if (!updatedLead) {
      throw new HttpException('Lead not found', 404);
    }
    return updatedLead;
  }

  @Post('leads/:id/respond')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('app-config.update')
  async respondToLead(
    @Param('id') id: string,
    @Body() dto: SendLeadResponseDto,
    @User() user: UserDetails
  ) {
    const result = await firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.SEND_RESPONSE },
        {
          id,
          dto,
          context: {
            userId: user.userId,
            profileId: user.profileId,
            appScope: 'owner-console',
          },
        }
      )
    );

    if (!result?.lead) {
      throw new HttpException(result?.delivery?.error || 'Lead not found', 404);
    }

    if (!result.delivery?.success) {
      throw new BadRequestException(
        result.delivery?.error || 'Failed to send lead response'
      );
    }

    return result;
  }

  @Get('hai/leads')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('app-config.update')
  async findHaiOwnerLeads(
    @User() user: UserDetails,
    @Query('status') status?: string,
    @Query('source') source?: string
  ) {
    await this.assertOwnerConsoleOwner(user?.profileId);
    return firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.FIND_ALL },
        {
          status,
          source,
          appScope: 'hai',
          profileId: user.profileId,
          ownerConsoleAccess: true,
        }
      )
    );
  }

  @Get('hai/leads/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('app-config.update')
  async getHaiOwnerLead(@Param('id') id: string, @User() user: UserDetails) {
    await this.assertOwnerConsoleOwner(user?.profileId);
    const lead = await firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.FIND_ONE },
        {
          id,
          profileId: user.profileId,
          ownerConsoleAccess: true,
        }
      )
    );
    if (!lead) {
      throw new HttpException('Lead not found', 404);
    }
    return lead;
  }

  @Patch('hai/leads/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('app-config.update')
  async updateHaiOwnerLead(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @User() user: UserDetails
  ) {
    await this.assertOwnerConsoleOwner(user?.profileId);
    const lead = await firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.UPDATE },
        {
          id,
          dto,
          profileId: user.profileId,
          ownerConsoleAccess: true,
        }
      )
    );
    if (!lead) {
      throw new HttpException('Lead not found', 404);
    }
    return lead;
  }

  @Post('hai/leads/:id/respond')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('app-config.update')
  async respondToHaiOwnerLead(
    @Param('id') id: string,
    @Body() dto: SendLeadResponseDto,
    @User() user: UserDetails
  ) {
    await this.assertOwnerConsoleOwner(user?.profileId);
    const result = await firstValueFrom(
      this.leadService.send(
        { cmd: LeadCommands.SEND_RESPONSE },
        {
          id,
          dto,
          context: {
            userId: user.userId,
            profileId: user.profileId,
            appScope: OWNER_CONSOLE_SCOPE,
            ownerConsoleAccess: true,
          },
        }
      )
    );
    if (!result?.lead) {
      throw new HttpException(result?.delivery?.error || 'Lead not found', 404);
    }
    if (!result.delivery?.success) {
      throw new BadRequestException(
        result.delivery?.error || 'Failed to send lead response'
      );
    }
    return result;
  }

  @Post('/find')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('blog.post.read')
  async findAllContacts(@Body() query: ContactQueryDto) {
    try {
      const contacts = await firstValueFrom(
        this.contactService.send({ cmd: ContactCommands.FIND_ALL }, query)
      );
      this.l.log('Contacts retrieved successfully');
      return contacts;
    } catch (error) {
      this.l.error('Error retrieving contacts', error);
      throw new HttpException(
        'Failed to retrieve contacts: [' + error.message + ']',
        500
      );
    }
  }

  @Get('/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('blog.post.read')
  async getContact(@Param('id') id: string) {
    try {
      const contact = await firstValueFrom(
        this.contactService.send({ cmd: ContactCommands.FIND }, id)
      );
      if (!contact) {
        this.l.error(`Contact ${id} not found`);
        throw new HttpException('Contact not found', 404);
      }
      this.l.log(`Contact ${id} retrieved successfully`);
      return contact;
    } catch (error) {
      this.l.error(`Error retrieving contact ${id}`, error);
      if (error.status === 404) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve contact: [' + error.message + ']',
        500
      );
    }
  }

  @Patch('/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('blog.post.update')
  async updateContact(
    @Param('id') id: string,
    @Body() updateData: UpdateContactDto
  ) {
    try {
      const updatedContact = await firstValueFrom(
        this.contactService.send(
          { cmd: ContactCommands.UPDATE },
          { id, updateContactDto: updateData }
        )
      );
      if (!updatedContact) {
        throw new HttpException('Contact not found', 404);
      }
      this.l.log(`Contact ${id} updated successfully`);
      return updatedContact;
    } catch (error) {
      this.l.error(`Error updating contact ${id}`, error);
      if (error.status === 404) {
        throw error;
      }
      throw new HttpException(
        'Failed to update contact: [' + error.message + ']',
        500
      );
    }
  }

  @Delete('/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('blog.post.delete')
  async deleteContact(@Param('id') id: string) {
    try {
      await firstValueFrom(
        this.contactService.send({ cmd: ContactCommands.DELETE }, id)
      );
      this.l.log(`Contact ${id} deleted successfully`);
      return { message: 'Contact deleted successfully' };
    } catch (error) {
      this.l.error(`Error deleting contact ${id}`, error);
      throw new HttpException(
        'Failed to delete contact: [' + error.message + ']',
        500
      );
    }
  }

  private getRoutingConfig(): ContactLeadRoutingConfig {
    return (
      this.configService.get<ContactLeadRoutingConfig>('contactLeads') || {
        appScopes: {},
      }
    );
  }

  private hasOwnerConsoleRole(assignment: RoleAssignment): boolean {
    const assignmentScope =
      typeof assignment.appScope === 'string'
        ? assignment.appScope
        : assignment.appScope?.name;
    return (
      assignmentScope === OWNER_CONSOLE_SCOPE &&
      OWNER_CONSOLE_ROLE_NAMES.has(assignment.role?.name || '')
    );
  }

  private async getRoleAssignments(
    profileId: string
  ): Promise<RoleAssignment[]> {
    try {
      return (await firstValueFrom(
        this.permissionsService.send(
          { cmd: RoleCommands.GetUserRoles },
          { profileId, appScope: OWNER_CONSOLE_SCOPE }
        )
      )) as RoleAssignment[];
    } catch (error) {
      this.l.error(
        `Failed to verify Owner Console roles for profile ${profileId}`,
        error
      );
      throw new ServiceUnavailableException(
        'Unable to verify Owner Console access.'
      );
    }
  }

  private async assertOwnerConsoleOwner(profileId?: string): Promise<void> {
    if (!profileId) {
      throw new ForbiddenException('An Owner Console profile is required.');
    }
    const assignments = await this.getRoleAssignments(profileId);
    if (
      !assignments?.some((assignment) => this.hasOwnerConsoleRole(assignment))
    ) {
      throw new ForbiddenException(
        'An Owner Console owner role is required to access HAI leads.'
      );
    }
  }

  private async resolveOwnerNotificationRecipients(): Promise<string[]> {
    let profiles: ProfileDto[];
    try {
      profiles = (await firstValueFrom(
        this.profileService.send({ cmd: ProfileCommands.GetAll }, { where: {} })
      )) as ProfileDto[];
    } catch (error) {
      this.l.error('Failed to enumerate Owner Console profiles', error);
      throw new ServiceUnavailableException(
        'Unable to resolve HAI notification recipients.'
      );
    }

    const candidateProfiles = (profiles || []).filter((profile) => profile?.id);
    let eligibleProfiles: ProfileDto[];
    try {
      eligibleProfiles = (
        await Promise.all(
          candidateProfiles.map(async (profile) => {
            const assignments = await this.getRoleAssignments(profile.id);
            return assignments?.some((assignment) =>
              this.hasOwnerConsoleRole(assignment)
            )
              ? profile
              : null;
          })
        )
      ).filter((profile): profile is ProfileDto => Boolean(profile));
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.l.error('Failed to resolve Owner Console role assignments', error);
      throw new ServiceUnavailableException(
        'Unable to resolve HAI notification recipients.'
      );
    }

    const recipients = Array.from(
      new Set(
        eligibleProfiles
          .map((profile) => profile.email?.trim().toLowerCase())
          .filter(
            (email): email is string =>
              Boolean(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          )
      )
    );
    if (!recipients.length) {
      throw new ServiceUnavailableException(
        'HAI contact intake is unavailable because no Owner Console notification recipient is configured.'
      );
    }
    return recipients;
  }

  private async resolveRouting(
    payload: PublicContactLeadIntakeDto
  ): Promise<{ profileId: string; sourceLabel?: string }> {
    const config = this.getRoutingConfig();
    const scopedConfig = config.appScopes?.[payload.appScope];
    const configuredProfileId =
      scopedConfig?.profileId?.trim() || config.defaultProfileId?.trim();

    if (configuredProfileId) {
      return {
        profileId: configuredProfileId,
        sourceLabel: scopedConfig?.sourceLabel,
      };
    }

    const globalProfiles = (await firstValueFrom(
      this.profileService.send(
        { cmd: ProfileCommands.GetAll },
        { where: { appScope: 'global' } }
      )
    )) as ProfileDto[];

    const fallbackProfileId = globalProfiles?.[0]?.id;
    if (!fallbackProfileId) {
      throw new BadRequestException(
        `No routing profile is configured for appScope "${payload.appScope}".`
      );
    }

    return {
      profileId: fallbackProfileId,
      sourceLabel: scopedConfig?.sourceLabel,
    };
  }

  private buildLeadNotes(
    payload: PublicContactLeadIntakeDto,
    linkedProfileId?: string
  ): string {
    return [
      `Public contact intake from ${payload.appScope}`,
      payload.subject ? `Subject: ${payload.subject}` : null,
      payload.company ? `Company: ${payload.company}` : null,
      payload.sourcePage ? `Source page: ${payload.sourcePage}` : null,
      linkedProfileId ? `Linked profile: ${linkedProfileId}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildLeadKeywords(payload: PublicContactLeadIntakeDto): string[] {
    return [
      'public-contact',
      `${payload.appScope}-contact`,
      payload.subject?.trim().toLowerCase().replace(/\s+/g, '-') || null,
    ].filter((value): value is string => Boolean(value));
  }
}
