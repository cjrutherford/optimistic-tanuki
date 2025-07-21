import { PartialType } from '@nestjs/mapped-types';
import { CreateProfileDto } from './create-profile.dto';
import { Profile } from '../entities/profile.entity';

export class UpdateProfileDto extends PartialType(CreateProfileDto) {
  id: string;
}

export const updateProfileDtoToPartial = (dto: UpdateProfileDto): Partial<Profile> => {
  const { id, name, description, userId, profilePic, coverPic, bio, location, occupation, interests, skills } = dto;
  const partialProfile: Partial<Profile> = {
    id, profileName: name, userId, profilePic, coverPic, bio, location, occupation, interests, skills
  };
  return partialProfile;
};