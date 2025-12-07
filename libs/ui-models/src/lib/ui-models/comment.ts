export interface CommentDto {
  id: string;
  content: string;
  userId: string;
  profileId: string;
  postId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentDto {
  content: string;
  userId?: string;
  profileId?: string;
  postId: string;
}

export interface UpdateCommentDto {
  content?: string;
}
