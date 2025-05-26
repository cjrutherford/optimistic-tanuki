export interface CreateCommentDto {
    content: string;
    postId: string;
    profileId: string;
    parentId?: string;
  }
  
  export interface CommentDto {
    id: string;
    content: string;
    postId: string;
    userId: string;
    parentId?: string;
    profileId: string;
  }
  
  export interface UpdateCommentDto {
    content?: string;
  }
  
  export interface SearchCommentDto {
    content?: string;
    postId?: string;
    userId?: string;
  }