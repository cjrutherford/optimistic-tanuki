import { PartialType } from '@nestjs/mapped-types';
import { CreateProfileDto } from './create-profile.dto';
import { Profile } from '../entities/profile.entity';

export class UpdateProfileDto extends PartialType(CreateProfileDto) {
  id: string;
}

export const updateProfileDtoToPartial = (
  dto: UpdateProfileDto
): Partial<Profile> => {
  const {
    id,
    name,
    description,
    userId,
    profilePic,
    coverPic,
    bio,
    location,
    occupation,
    interests,
    skills,
  } = dto;
  // Explicit nulls are never valid updates (these columns are NOT NULL) and
  // arrive routinely from form controls for untouched fields. Drop them so
  // TypeORM leaves the stored values alone instead of violating constraints.
  const partialProfile: Partial<Profile> = {
    id,
    profileName: name,
    userId,
    profilePic,
    coverPic,
    bio,
    location,
    occupation,
    interests,
    skills,
  };
  for (const key of Object.keys(
    partialProfile
  ) as (keyof typeof partialProfile)[]) {
    if (partialProfile[key] === null || partialProfile[key] === undefined) {
      delete partialProfile[key];
    }
  }
  return partialProfile;
};
