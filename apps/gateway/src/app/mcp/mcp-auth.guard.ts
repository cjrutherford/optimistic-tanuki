import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserContext } from '@optimistic-tanuki/models';

interface McpJwtPayload {
  userId: string;
  email: string;
  name: string;
  profileId: string;
}

/**
 * Authenticates every request hitting the gateway's MCP transport
 * (SSE + streamable HTTP), attaching a UserContext to `request.user` so
 * downstream @McpTool / @Resource handlers can derive identity from the
 * authenticated caller instead of trusting client-supplied arguments.
 *
 * There is no @Public concept here - the MCP surface is authenticated-only.
 */
@Injectable()
export class McpAuthGuard implements CanActivate {
  private readonly logger = new Logger(McpAuthGuard.name);
  private jwtService: JwtService | undefined;

  constructor(private readonly config: ConfigService) {}

  private getJwtService(): JwtService {
    if (!this.jwtService) {
      const secret =
        this.config.get<string>('auth.jwtSecret') ??
        this.config.get<string>('auth.jwt_secret');

      if (!secret) {
        throw new Error(
          'JWT secret is not configured; set JWT_SECRET or auth.jwtSecret'
        );
      }

      this.jwtService = new JwtService({ secret });
    }

    return this.jwtService;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Unauthorized: No Auth Header Provided.');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Unauthorized: Token Invalid.');
    }

    // Let a missing/misconfigured JWT secret surface as a clear
    // configuration error rather than being swallowed into a generic 401.
    const jwtService = this.getJwtService();

    try {
      const payload = await jwtService.verifyAsync<McpJwtPayload>(token);

      const userContext: UserContext = {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        profileId: payload.profileId,
        scopes: [],
        roles: [],
      };

      request.user = userContext;
      return true;
    } catch (error) {
      this.logger.warn(`MCP auth failed: ${error.message}`);
      throw new UnauthorizedException(
        'Unauthorized: Token Invalid or Expired.'
      );
    }
  }
}
