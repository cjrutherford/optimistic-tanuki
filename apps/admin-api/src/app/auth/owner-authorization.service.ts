import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

type OwnerTokenPayload = { profileId?: string };
type FetchLike = typeof fetch;

const OWNER_ROLE_NAMES = new Set([
  'owner_console_owner',
  'owner',
  'global_admin',
  'system_admin',
]);

@Injectable()
export class OwnerAuthorizationService {
  constructor(
    private readonly config: ConfigService,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  verifyToken(token: string): OwnerTokenPayload {
    const jwtSecret = this.config.get<string>('admin-api.jwtSecret');
    if (!jwtSecret) {
      throw new UnauthorizedException('Owner authorization is not configured');
    }
    return new JwtService({ secret: jwtSecret }).verify<OwnerTokenPayload>(
      token
    );
  }

  async assertAuthorized(authorization?: string): Promise<void> {
    const token = this.extractBearerToken(authorization);
    let payload: OwnerTokenPayload;
    try {
      payload = this.verifyToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired owner token');
    }

    if (!payload.profileId) {
      throw new ForbiddenException('Owner profile is required');
    }

    const gatewayBaseUrl = this.config.get<string>('admin-api.gatewayBaseUrl');
    const rolesResponse = await this.fetchImpl(
      `${gatewayBaseUrl}/api/permissions/user-roles/${encodeURIComponent(
        payload.profileId
      )}?appScope=owner-console`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-ot-appscope': 'owner-console',
        },
      }
    );
    if (!rolesResponse.ok) {
      throw new UnauthorizedException('Unable to verify owner access');
    }

    const roles = (await rolesResponse.json()) as Array<{
      name?: string;
      role?: { name?: string };
    }>;
    if (
      !roles.some((assignment) =>
        OWNER_ROLE_NAMES.has(assignment.role?.name ?? assignment.name ?? '')
      )
    ) {
      throw new ForbiddenException('Owner access is required');
    }
  }

  private extractBearerToken(authorization?: string): string {
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token is required');
    }
    return token;
  }
}
