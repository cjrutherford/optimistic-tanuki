import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { ProfileCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

export enum BlogPermission {
  POST = 'post',
  PROMOTE = 'promote',
}

export const BLOG_PERMISSIONS_KEY = 'blogPermissions';

@Injectable()
export class BlogPermissionGuard implements CanActivate {
  constructor(
    @Inject(ServiceTokens.PROFILE_SERVICE) private profileService: ClientProxy,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<BlogPermission[]>(
      BLOG_PERMISSIONS_KEY,
      context.getHandler()
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      const blogRole = await firstValueFrom(
        this.profileService.send({ cmd: ProfileCommands.GetBlogRole }, user.userId)
      );

      // Check if user has required permissions
      const hasPermission = this.checkPermissions(blogRole, requiredPermissions);

      if (!hasPermission) {
        throw new ForbiddenException(
          'You do not have permission to perform this action. Contact an administrator to be granted blog posting privileges.'
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new ForbiddenException('Unable to verify blog permissions');
    }
  }

  private checkPermissions(blogRole: string, requiredPermissions: BlogPermission[]): boolean {
    // OWNER has all permissions
    if (blogRole === 'owner') {
      return true;
    }

    // POSTER can only post, not promote
    if (blogRole === 'poster') {
      return requiredPermissions.every(permission => permission === BlogPermission.POST);
    }

    // NONE has no permissions
    return false;
  }
}
