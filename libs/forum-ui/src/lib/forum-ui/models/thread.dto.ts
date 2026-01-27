export interface ThreadDto {
  id: string;
  title: string;
  description: string;
  userId: string;
  profileId: string;
  topicId: string;
  createdAt: Date;
  updatedAt: Date;
  visibility: 'public' | 'private';
  isPinned: boolean;
  isLocked: boolean;
  viewCount: number;
}

export interface CreateThreadDto {
  title: string;
  description: string;
  userId: string;
  profileId: string;
  topicId: string;
  visibility?: 'public' | 'private';
}
