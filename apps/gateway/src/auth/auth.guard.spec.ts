import { AuthGuard } from './auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AuthCommands } from '@optimistic-tanuki/constants';

describe('AuthGuard', () => {
    let authGuard: AuthGuard;
    let reflector: Reflector;
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    let clientProxy: any;

    beforeEach(() => {
        reflector = new Reflector(); // Create a Reflector instance
        clientProxy = {
            send: jest.fn().mockReturnValue(of({}))
        };
        authGuard = new AuthGuard(clientProxy, reflector); // Instantiate AuthGuard with Reflector
        jest.spyOn(authGuard, 'parseToken').mockReturnValue({ id: 1, name: 'Test User' }); // Mock parseToken
    });

    describe('canActivate', () => {
        it('should return true if the user is authenticated', async () => {
            // Mock ExecutionContext and Reflector to simulate an authenticated user
            clientProxy.send = jest.fn().mockReturnValue(of({ isValid: true }));

            jest.spyOn(authGuard, 'parseToken').mockReturnValue({ id: 1, name: 'Test User' });

            const context = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        headers: {
                            authorization: 'Bearer valid-token', // Simulate a valid token
                        },
                    }),
                }),
                getHandler: jest.fn(), // Mock getHandler
                getClass: jest.fn(), // Mock getClass
            } as unknown as jest.Mocked<ExecutionContext>;

            const canActivate = await authGuard.canActivate(context);
            expect(clientProxy.send).toHaveBeenCalledWith({ cmd: AuthCommands.Validate }, { token: 'valid-token' });
            expect(canActivate).toBe(true); // Assuming your guard validates 'valid-token'
        });

        it('should throw UnauthorizedException if no authorization header is provided', async () => {
            // Mock ExecutionContext to simulate an unauthenticated user (no token)
            const context = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        headers: {}, // No authorization header
                    }),
                }),
                getHandler: jest.fn(), // Mock getHandler
                getClass: jest.fn(), // Mock getClass
            } as unknown as jest.Mocked<ExecutionContext>;

            await expect(authGuard.canActivate(context)).rejects.toThrowError(UnauthorizedException);
        });

        it('should throw UnauthorizedException for invalid token', async () => {
            clientProxy.send = jest.fn().mockReturnValue(of({ isValid: false }));

            const context = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        headers: {
                            authorization: 'Bearer invalid-token', // Simulate an invalid token
                        },
                    }),
                }),
                getHandler: jest.fn(), // Mock getHandler
                getClass: jest.fn(), // Mock getClass
            } as unknown as jest.Mocked<ExecutionContext>;

            await expect(authGuard.canActivate(context)).rejects.toThrowError(UnauthorizedException);
            expect(clientProxy.send).toHaveBeenCalledWith({ cmd: AuthCommands.Validate }, { token: 'invalid-token' });
        });
    });
});