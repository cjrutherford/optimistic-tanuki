import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
/**
 * Represents a login request.
 */
export default class LoginRequest {
  /**
   * The user's email address.
   */
  @ApiProperty()
  email!: string;
  /**
   * The user's password.
   */
  @ApiProperty()
  password!: string;
  /**
   * Optional multi-factor authentication token.
   */
  @ApiPropertyOptional({ default: false })
  mfa?:string;
}
