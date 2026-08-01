import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const UserDetailsDecorator = (
  data: unknown,
  ctx: ExecutionContext
): UserDetails => {
  const request = ctx.switchToHttp().getRequest();
  // AuthGuard sets this from either a verified bearer token or the HttpOnly
  // session cookie. Prefer it so controllers never re-parse an untrusted
  // browser credential and cookie sessions work identically to bearer flows.
  const user = request.user as UserDetails | undefined;
  if (!user) {
    return null;
  }
  return data && typeof data === 'string'
    ? ((user as Record<string, unknown>)[data] as unknown as UserDetails)
    : user;
};

export const User = createParamDecorator(UserDetailsDecorator);

export declare type UserDetails = {
  email: string;
  exp: number;
  iat: number;
  name: string;
  userId: string;
  profileId: string;
};
