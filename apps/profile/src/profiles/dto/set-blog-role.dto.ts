import { BlogRole } from '../entities/profile.entity';
import { IsEnum, IsString } from 'class-validator';

export class SetBlogRoleDto {
  @IsString()
  profileId: string;

  @IsEnum(BlogRole)
  blogRole: BlogRole;
}
