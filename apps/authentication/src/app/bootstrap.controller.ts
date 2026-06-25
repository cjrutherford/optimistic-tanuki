import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

interface CreateOwnerRequest {
  name: string;
  email: string;
  role?: string;
}

interface ActivateOwnerRequest {
  token: string;
}

interface OwnerProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'bootstrap' | 'active';
}

@ApiTags('bootstrap')
@Controller('api/bootstrap')
export class BootstrapController {
  private static ownerProfile: OwnerProfile | null = null;
  private static activationToken: string | null = null;

  constructor(private readonly appService: AppService) {}

  @Post('owner')
  @ApiOperation({ summary: 'Create initial platform owner profile' })
  @ApiResponse({ status: 201, description: 'Owner profile created' })
  @ApiResponse({ status: 409, description: 'Owner already exists' })
  async createOwner(@Body() body: CreateOwnerRequest) {
    if (BootstrapController.ownerProfile) {
      throw new UnauthorizedException('Owner already configured');
    }

    const token = this.generateToken();
    const profile: OwnerProfile = {
      id: 'owner-' + Date.now(),
      name: body.name,
      email: body.email,
      role: body.role || 'platform-owner',
      status: 'bootstrap',
    };

    BootstrapController.ownerProfile = profile;
    BootstrapController.activationToken = token;

    return {
      token,
      profileId: profile.id,
    };
  }

  @Post('owner/activate')
  @ApiOperation({ summary: 'Activate owner account' })
  @ApiResponse({ status: 200, description: 'Owner activated' })
  @ApiResponse({ status: 404, description: 'Invalid or already used token' })
  async activateOwner(@Body() body: ActivateOwnerRequest) {
    if (
      !BootstrapController.activationToken ||
      !BootstrapController.ownerProfile
    ) {
      throw new UnauthorizedException('No pending bootstrap');
    }

    if (body.token !== BootstrapController.activationToken) {
      throw new UnauthorizedException('Invalid token');
    }

    BootstrapController.ownerProfile.status = 'active';
    const activatedProfile = { ...BootstrapController.ownerProfile };
    BootstrapController.activationToken = null;

    return {
      activated: true,
      profile: activatedProfile,
    };
  }

  @Get('owner/status')
  @ApiOperation({ summary: 'Get owner bootstrap status' })
  @ApiResponse({ status: 200, description: 'Owner status returned' })
  getOwnerStatus() {
    if (!BootstrapController.ownerProfile) {
      return { configured: false };
    }

    return {
      configured: BootstrapController.ownerProfile.status === 'active',
      profile: {
        id: BootstrapController.ownerProfile.id,
        name: BootstrapController.ownerProfile.name,
        email: BootstrapController.ownerProfile.email,
        status: BootstrapController.ownerProfile.status,
      },
    };
  }

  private generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
