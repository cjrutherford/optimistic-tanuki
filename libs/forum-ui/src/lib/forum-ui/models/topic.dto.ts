export interface TopicDto {
  id: string;
  title: string;  // Changed from 'name' to 'title' to match backend
  description: string;
  userId: string;
  profileId: string;
  createdAt: Date;
  updatedAt: Date;
  visibility: 'public' | 'private';
  isPinned: boolean;
  isLocked: boolean;
}


export interface CreateTopicDto {
  title: string;  // Changed from 'name' to 'title' to match backend
  description: string;
  userId: string;
  profileId: string;
  visibility?: 'public' | 'private' | boolean;
}
