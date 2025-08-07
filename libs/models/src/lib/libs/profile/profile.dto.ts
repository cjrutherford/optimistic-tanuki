 /**
  * Data transfer object for a user profile.
  */
 export class ProfileDto {
    /**
     * The unique identifier of the profile.
     */
    id: string;
    /**
     * The name of the profile.
     */
    name: string;
    /**
     * The email associated with the profile.
     */
    email: string;
    /**
     * The biography of the profile.
     */
    bio: string;
    /**
     * The URL of the profile's avatar.
     */
    avatarUrl: string;
    /**
     * The timestamp when the profile was created.
     */
    createdAt: Date;
    /**
     * The timestamp when the profile was last updated.
     */
    updatedAt: Date;
 }