import { BlogRole } from '../entities/profile.entity';

export class SetBlogRoleDto {
    profileId: string;
    blogRole: BlogRole;
}
