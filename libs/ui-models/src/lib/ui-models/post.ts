export interface PostDto {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  profileId: string;
}

export interface CreatePostDto {
  title: string;
  content: string;
  userId?: string;
  profileId?: string;
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
}
