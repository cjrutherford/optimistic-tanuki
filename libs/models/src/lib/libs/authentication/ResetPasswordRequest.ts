import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Represents a request to reset a user's password.
 */
export default class ResetPasswordRequest {
    /**
     * The user's email address.
     */
    @ApiProperty()
    email = '';
  /**
   * The user's old password.
   */
  @ApiProperty()
  oldPass = '';
  /**
   * The confirmation of the new password.
   */
  @ApiProperty()
  newConf = '';
  /**
   * The new password.
   */
  @ApiProperty()
  newPass = '';
  /**
   * Optional multi-factor authentication token.
   */
  @ApiPropertyOptional()
  mfa?:string;
}