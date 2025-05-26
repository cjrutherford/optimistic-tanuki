export interface CreateAttachmentDto {
    url: string;
    postId: string;
  }
  
  export interface AttachmentDto {
    id: string;
    url: string;
    name: string;
    type: Blob["type"];
    postId: string;
    userId: string;
  }
  
  export interface UpdateAttachmentDto {
    url?: string;
  }
  
  export interface SearchAttachmentDto {
    url?: string;
    postId?: string;
    userId?: string;
  }