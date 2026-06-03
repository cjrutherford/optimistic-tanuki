import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  ContactCommands,
  LeadCommands,
  ProfileCommands,
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

type ContactLeadRoutingConfig = {
  defaultProfileId?: string;
  appScopes?: Record<string, ContactLeadRoutingEntry>;
};

@Controller('contact')
export class ContactController {
  constructor(
    @Inject(ServiceTokens.BLOG_SERVICE)
    private readonly contactService: ClientProxy,
    @Inject(ServiceTokens.LEAD_SERVICE)
    private readonly leadService: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileService: ClientProxy,
    private readonly configService: ConfigService,
    private readonly l: Logger
  ) {
    this.l.log('ContactController initialized');
  }

  @Public()
  @UseGuards(AuthGuard)
  @Post()
  async createContact(
    @Body() contactLead: PublicContactLeadIntakeDto,
    @User() user?: UserDetails | null
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
      const linkedUserId =
        user?.userId || `public-contact:${contactLead.appScope}`;
      const linkedProfileId = user?.profileId || '';

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
