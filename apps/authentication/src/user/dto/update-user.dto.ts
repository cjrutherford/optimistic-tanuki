import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  firstName?: string | undefined;
  lastName?: string | undefined;
  email?: string | undefined;

  bio?: string | undefined;
  oldPassword?: string | undefined;
  newPassword?: string | undefined;
  confirmPassword?: string | undefined;
}
