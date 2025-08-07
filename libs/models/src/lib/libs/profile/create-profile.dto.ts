import { ApiProperty } from '@nestjs/swagger';

/**
 * Data transfer object for creating a new profile.
 */
export class CreateProfileDto {
    /**
     * The name of the profile.
     */
    @ApiProperty({ description: 'Name of the profile' })
    name: string;

    /**
     * The description of the profile.
     */
    @ApiProperty({ description: 'Description of the profile' })
    description: string;

    /**
     * The user ID associated with the profile.
     */
    @ApiProperty({ description: 'User ID associated with the profile' })
    userId: string;

    /**
     * The URL of the profile picture.
     */
    @ApiProperty({ description: 'URL of the profile picture' })
    profilePic: string;

    /**
     * The URL of the cover picture.
     */
    @ApiProperty({ description: 'URL of the cover picture' })
    coverPic: string;

    /**
     * The biography of the profile.
     */
    @ApiProperty({ description: 'Bio of the profile' })
    bio: string;

    /**
     * The location of the profile.
     */
    @ApiProperty({ description: 'Location of the profile' })
    location: string;

    /**
     * The occupation of the profile.
     */
    @ApiProperty({ description: 'Occupation of the profile' })
    occupation: string;

    /**
     * The interests of the profile.
     */
    @ApiProperty({ description: 'Interests of the profile' })
    interests: string;

    /**
     * The skills of the profile.
     */
    @ApiProperty({ description: 'Skills of the profile' })
    skills: string;
}
