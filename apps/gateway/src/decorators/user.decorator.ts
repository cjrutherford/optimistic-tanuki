import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const UserDetailsDecorator = (data: unknown, ctx: ExecutionContext): UserDetails => {
  const request = ctx.switchToHttp().getRequest();
  const token = request.headers['authorization']?.split(' ')[1];
  if (!token) {
    return null;
  }
  return parseToken(token);
}

export const User = createParamDecorator(
  UserDetailsDecorator
);

const parseToken = (token: string): UserDetails => {
    // Assuming the token is a JWT token
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Malformed token');
      }
      const payload = tokenParts[1];
      // Use base64url decoding for JWT
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      const decoded = Buffer.from(padded, 'base64').toString('utf8');
      return JSON.parse(decoded) as UserDetails;
    } catch (e) {
      throw new Error('Invalid token ' + e);
    }
};


export declare type UserDetails = {
  email: string;
  exp: number;
  iat: number;
  name: string;
  userId: string;
}