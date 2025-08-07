/**
 * Data transfer object for a user profile.
 */
export declare type ProfileDto = {
    /** The unique identifier of the profile. */
    id: string;
    /** The ID of the user associated with this profile. */
    userId: string;
    /** The name of the profile. */
    profileName: string;
    /** The URL of the profile picture. */
    profilePic: string;
    /** The URL of the cover picture. */
    coverPic: string;
    /** The biography of the profile. */
    bio: string;
    /** The location of the profile. */
    location: string;
    /** The occupation of the profile. */
    occupation: string;
    /** The interests of the profile. */
    interests: string;
    /** The skills of the profile. */
    skills: string;
    /** The creation timestamp of the profile. */
    created_at: Date;
  }
  
  /**
   * Data transfer object for creating a new user profile.
   */
  export declare type CreateProfileDto = {
    /** The name of the profile. */
    name: string;
    /** The description of the profile. */
    description: string;
    /** The ID of the user associated with this profile. */
    userId: string;
    /** The URL of the profile picture. */
    profilePic: string;
    /** The URL of the cover picture. */
    coverPic: string;
    /** The biography of the profile. */
    bio: string;
    /** The location of the profile. */
    location: string;
    /** The occupation of the profile. */
    occupation: string;
    /** The interests of the profile. */
    interests: string;
    /** The skills of the profile. */
    skills: string;
  }
  
  /**
   * Data transfer object for updating an existing user profile.
   */
  export declare type UpdateProfileDto = {
    /** The unique identifier of the profile to update. */
    id: string;
    /** The new name of the profile (optional). */
    name?: string;
    /** The new description of the profile (optional). */
    description?: string;
    /** The new user ID associated with this profile (optional). */
    userId?: string;
    /** The new URL of the profile picture (optional). */
    profilePic?: string;
    /** The new URL of the cover picture (optional). */
    coverPic?: string;
    /** The new biography of the profile (optional). */
    bio?: string;
    /** The new location of the profile (optional). */
    location?: string;
    /** The new occupation of the profile (optional). */
    occupation?: string;
    /** The new interests of the profile (optional). */
    interests?: string;
    /** The new skills of the profile (optional). */
    skills?: string;
  }