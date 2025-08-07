import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/**
 * Data transfer object for updating an existing user.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {
  /**
   * The first name of the user (optional).
   */
  firstName?: string | undefined;
  /**
   * The last name of the user (optional).
   */
  lastName?: string | undefined;
  /**
   * The email address of the user (optional).
   */
  email?: string | undefined;

  /**
   * The biography of the user (optional).
   */
  bio?: string | undefined;
  /**
   * The old password of the user (optional).
   */
  oldPassword?: string | undefined;
  /**
   * The new password for the user (optional).
   */
  newPassword?: string | undefined;
  /**
   * The confirmation of the new password for the user (optional).
   */
  confirmPassword?: string | undefined;
}
