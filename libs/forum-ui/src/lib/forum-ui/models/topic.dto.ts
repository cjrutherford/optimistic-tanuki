export interface TopicDto {
  id: string;
  title: string;
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
  title: string;
  description: string;
  profileId: string;
  visibility?: 'public' | 'private';
}
