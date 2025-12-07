import { SetMetadata } from '@nestjs/common';
import { BlogPermission, BLOG_PERMISSIONS_KEY } from '../auth/blog-permission.guard';

export const RequireBlogPermissions = (...permissions: BlogPermission[]) =>
  SetMetadata(BLOG_PERMISSIONS_KEY, permissions);
