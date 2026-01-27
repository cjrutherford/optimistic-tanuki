export interface TopicDto {
  id: string;
  name: string;
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
  name: string;
  description: string;
  userId: string;
  profileId: string;
  visibility?: 'public' | 'private';
}
