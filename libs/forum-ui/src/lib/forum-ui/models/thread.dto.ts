export interface ThreadDto {
  id: string;
  title: string;
  content: string;
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
  content: string;
  profileId: string;
  topicId: string;
}
