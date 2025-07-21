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
    const payload = Buffer.from(token.split('.')[1], 'base64').toString('utf-8');
    return JSON.parse(payload) as UserDetails;
};


export declare type UserDetails = {
  email: string;
  exp: number;
  iat: number;
  name: string;
  userId: string;
}