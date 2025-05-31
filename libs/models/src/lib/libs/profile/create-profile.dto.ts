import { ApiProperty } from '@nestjs/swagger';

export class CreateProfileDto {
    @ApiProperty({ description: 'Name of the profile' })
    name: string;

    @ApiProperty({ description: 'Description of the profile' })
    description: string;

    @ApiProperty({ description: 'User ID associated with the profile' })
    userId: string;

    @ApiProperty({ description: 'URL of the profile picture' })
    profilePic: string;

    @ApiProperty({ description: 'URL of the cover picture' })
    coverPic: string;

    @ApiProperty({ description: 'Bio of the profile' })
    bio: string;

    @ApiProperty({ description: 'Location of the profile' })
    location: string;

    @ApiProperty({ description: 'Occupation of the profile' })
    occupation: string;

    @ApiProperty({ description: 'Interests of the profile' })
    interests: string;

    @ApiProperty({ description: 'Skills of the profile' })
    skills: string;
}
