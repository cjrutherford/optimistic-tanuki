import { Body, Controller, Inject, Post, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  EnableMultiFactorRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  ValidateTokenRequest,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';

@ApiTags('authentication')
@Controller('authentication')
export class AuthenticationController {
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE) private readonly authClient: ClientProxy,
  ) {
    this.authClient.connect().then(() => { 
      console.log('AuthenticationController connected to authClient');
    }).catch(e => console.error(e));
  }

  @Post('login')
  @ApiOperation({ summary: 'Login a user' })
  @ApiResponse({ status: 201, description: 'User logged in successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async loginUser(@Body() data: LoginRequest) {
    try {
      console.log('loginUser:', data);
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.Login }, data),
      );
    } catch (error) {
      console.error('Error in loginUser:', error);
      throw new HttpException(`Login failed: ${error}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async registerUser(@Body() data: RegisterRequest) {
    try {
      console.log('registerUser:', data);
      const result = await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.Register }, data),
      );
      return result;
    } catch (error) {
        console.dir(error);
      console.error('Error in registerUser:', error);
      throw new HttpException(`Registration failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset user password' })
  @ApiResponse({ status: 201, description: 'Password reset successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async resetPassword(@Body() data: ResetPasswordRequest) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.ResetPassword }, data),
      );
    } catch (error) {
      console.error('Error in resetPassword:', error);
      throw new HttpException(`Password reset failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('enable-mfa')
  @ApiOperation({ summary: 'Enable multi-factor authentication' })
  @ApiResponse({ status: 201, description: 'MFA enabled successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async enableMfa(@Body() data: EnableMultiFactorRequest) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.EnableMultiFactor }, data),
      );
    } catch (error) {
      console.error('Error in enableMfa:', error);
      throw new HttpException(`Enable MFA failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate authentication token' })
  @ApiResponse({ status: 201, description: 'Token validated successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async validateToken(@Body() data: ValidateTokenRequest) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.Validate }, data),
      );
    } catch (error) {
      console.error('Error in validateToken:', error);
      throw new HttpException(`Token validation failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('validate-mfa')
  @ApiOperation({ summary: 'Validate multi-factor authentication token' })
  @ApiResponse({ status: 201, description: 'MFA token validated successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async validateMfa(@Body() data: { userId: string; token: string }) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.ValidateTotp }, data),
      );
    } catch (error) {
      console.error('Error in validateMfa:', error);
      throw new HttpException(`MFA validation failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
