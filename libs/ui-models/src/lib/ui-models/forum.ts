export interface TopicDto {
  id: string;
  title: string;
  description: string;
  userId: string;
  profileId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  visibility: 'public' | 'private';
  isPinned: boolean;
  isLocked: boolean;
}

export interface ThreadDto {
  id: string;
  title: string;
  description: string;
  content: string;
  userId: string;
  profileId: string;
  topicId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  visibility: 'public' | 'private';
  isPinned: boolean;
  isLocked: boolean;
  viewCount: number;
  moderationStatus: 'visible' | 'hidden';
  moderationNotes?: string | null;
  moderatedBy?: string | null;
  moderatedAt?: Date | string | null;
}

export interface ForumPostDto {
  id: string;
  content: string;
  userId: string;
  profileId: string;
  threadId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  isEdited: boolean;
  moderationStatus: 'visible' | 'hidden';
  moderationNotes?: string | null;
  moderatedBy?: string | null;
  moderatedAt?: Date | string | null;
}

export interface UpdateTopicDto {
  title?: string;
  description?: string;
  visibility?: 'public' | 'private';
  isPinned?: boolean;
  isLocked?: boolean;
}

export interface UpdateThreadDto {
  title?: string;
  content?: string;
  visibility?: 'public' | 'private';
  isPinned?: boolean;
  isLocked?: boolean;
}
