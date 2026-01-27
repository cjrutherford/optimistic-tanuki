export interface ForumPostDto {
  id: string;
  content: string;
  userId: string;
  profileId: string;
  threadId: string;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
}

export interface CreateForumPostDto {
  content: string;
  userId: string;
  profileId: string;
  threadId: string;
}
