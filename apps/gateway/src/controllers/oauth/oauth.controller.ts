import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  LinkProviderRequest,
  OAuthCallbackRequest,
  UnlinkProviderRequest,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import {
  AuthCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { Public } from '../../decorators/public.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import { AppScope } from '../../decorators/appscope.decorator';
import {
  RoleInitService,
} from '@optimistic-tanuki/permission-lib';

@ApiTags('oauth')
@Controller('oauth')
export class OAuthController {
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    private readonly logger: Logger,
    private readonly roleInit: RoleInitService
  ) {
    this.authClient
      .connect()
      .then(() => {
        this.logger.log('OAuthController connected to authClient');
      })
      .catch((e) => this.logger.error('OAuthController connection error:', e));
  }

  @Post('callback')
  @Public()
  @ApiOperation({
    summary: 'Handle OAuth provider callback',
    description:
      'Processes the OAuth callback from a provider. If the user exists, returns a JWT. If not, returns registration info.',
  })
  @ApiResponse({ status: 201, description: 'OAuth callback processed successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async oauthCallback(
    @Body() data: OAuthCallbackRequest,
    @AppScope() appScope: string
  ) {
    try {
      this.logger.debug(`OAuth callback for provider=${data.provider}`);

      // The actual OAuth token exchange would happen here in a real implementation.
      // For now, we expect the client to have already exchanged the code for tokens
      // and provide the provider user info directly.
      // This keeps the gateway stateless and allows the client to handle provider-specific flows.

      const result = await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.OAuthLogin }, data)
      );

      // If login was successful and returned a token, handle profile like regular login
      if (result.code === 0 && result.data?.newToken) {
        return result;
      }

      // If user needs registration, return the provider info
      if (result.data?.needsRegistration) {
        return result;
      }

      return result;
    } catch (error) {
      this.logger.error('Error in oauthCallback:', error?.message || error);
      throw new HttpException(
        `OAuth callback failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('link')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Link an OAuth provider to the current user account',
    description:
      'Links a new OAuth provider (Google, GitHub, etc.) to the authenticated user\'s account.',
  })
  @ApiResponse({ status: 201, description: 'Provider linked successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async linkProvider(
    @Body() data: Omit<LinkProviderRequest, 'userId'>,
    @User() user: UserDetails
  ) {
    try {
      this.logger.debug(
        `Linking provider=${data.provider} to userId=${user.userId}`
      );
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.LinkProvider },
          { ...data, userId: user.userId }
        )
      );
    } catch (error) {
      this.logger.error('Error in linkProvider:', error?.message || error);
      throw new HttpException(
        `Link provider failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('unlink')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Unlink an OAuth provider from the current user account',
    description:
      'Removes a linked OAuth provider from the authenticated user\'s account.',
  })
  @ApiResponse({ status: 201, description: 'Provider unlinked successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async unlinkProvider(
    @Body() data: Omit<UnlinkProviderRequest, 'userId'>,
    @User() user: UserDetails
  ) {
    try {
      this.logger.debug(
        `Unlinking provider=${data.provider} from userId=${user.userId}`
      );
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.UnlinkProvider },
          { ...data, userId: user.userId }
        )
      );
    } catch (error) {
      this.logger.error('Error in unlinkProvider:', error?.message || error);
      throw new HttpException(
        `Unlink provider failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('providers')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get linked OAuth providers for the current user',
    description:
      'Returns a list of all OAuth providers linked to the authenticated user\'s account.',
  })
  @ApiResponse({
    status: 200,
    description: 'Linked providers retrieved successfully.',
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async getLinkedProviders(@User() user: UserDetails) {
    try {
      this.logger.debug(`Getting linked providers for userId=${user.userId}`);
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.GetLinkedProviders },
          { userId: user.userId }
        )
      );
    } catch (error) {
      this.logger.error(
        'Error in getLinkedProviders:',
        error?.message || error
      );
      throw new HttpException(
        `Get linked providers failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
