import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserDetails => {
    const request = ctx.switchToHttp().getRequest();
    const token = request.headers['authorization']?.split(' ')[1];
    if (!token) {
      return null;
    }
    return parseToken(token);
  },
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