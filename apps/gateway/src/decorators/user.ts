import { createParamDecorator, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserDecoratorFactory {
    constructor(private readonly jwtService: JwtService) {}

    createUserDecorator() {
        return createParamDecorator(
            (data: unknown, ctx: ExecutionContext) => {
                const request = ctx.switchToHttp().getRequest();
                const token = request.headers.authorization?.split(' ')[1];
                if (!token) {
                    return null;
                }

                const decodedToken = this.jwtService.decode(token);
                return decodedToken ? decodedToken['user'] : null;
            },
        )();
    }
}