import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export function UserDetailsDecorator(
  data: null | undefined,
  ctx: ExecutionContext
): UserDetails | null;
export function UserDetailsDecorator<Key extends keyof UserDetails>(
  data: Key,
  ctx: ExecutionContext
): UserDetails[Key] | null;
export function UserDetailsDecorator(
  data: keyof UserDetails | null | undefined,
  ctx: ExecutionContext
): UserDetails | UserDetails[keyof UserDetails] | null {
  const request = ctx.switchToHttp().getRequest();
  // AuthGuard sets this from either a verified bearer token or the HttpOnly
  // session cookie. Prefer it so controllers never re-parse an untrusted
  // browser credential and cookie sessions work identically to bearer flows.
  const user = request.user as UserDetails | undefined;
  if (!user) {
    return null;
  }
  return data ? user[data] : user;
}

export const User = createParamDecorator(UserDetailsDecorator);

export declare type UserDetails = {
  email: string;
  exp: number;
  iat: number;
  name: string;
  userId: string;
  profileId: string;
  emailVerified?: boolean;
};
