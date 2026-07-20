export declare type ProfileDto = {
  id: string;
  userId: string;
  profileName: string;
  email?: string;
  profilePic: string;
  coverPic: string;
  bio: string;
  avatarUrl?: string;
  location?: string;
  occupation?: string;
  interests?: string;
  skills?: string;
  createdAt?: Date;
  created_at?: Date;
  updatedAt?: Date;
  appScope?: string;
};

export declare type CreateProfileDto = {
  name: string;
  description: string;
  userId: string;
  profilePic: string;
  coverPic: string;
  bio: string;
  location?: string;
  occupation?: string;
  interests?: string;
  skills?: string;
  appScope?: string;
};

export declare type UpdateProfileDto = {
  id: string;
  name?: string;
  description?: string;
  userId?: string;
  profilePic?: string;
  coverPic?: string;
  bio?: string;
  location?: string;
  occupation?: string;
  interests?: string;
  skills?: string;
  appScope?: string;
};
