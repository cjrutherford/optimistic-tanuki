
import { AttachmentDto, CommentDto } from '.';


/**
 * Data transfer object for creating a new post.
 */
export interface CreatePostDto {
    /**
     * The title of the post.
     */
    title: string;
    /**
     * The content of the post.
     */
    content: string;
    /**
     * Optional array of attachment IDs.
     */
    attachments?: string[];
    /**
     * The ID of the profile creating the post.
     */
    profileId: string;
  }
  
  /**
   * Data transfer object for a post.
   */
  export interface PostDto {
    /**
     * The unique identifier of the post.
     */
    id: string;
    /**
     * The title of the post.
     */
    title: string;
    /**
     * The content of the post.
     */
    content: string;
    /**
     * Optional array of attachment DTOs.
     */
    attachments?:AttachmentDto[];
    /**
     * The ID of the user who created the post.
     */
    userId: string;
    /**
     * The ID of the profile that created the post.
     */
    profileId: string;
    /**
     * The timestamp when the post was created.
     */
    createdAt: Date;
    /**
     * Optional array of links associated with the post.
     */
    links?: { url: string }[];
    /**
     * Optional array of comment DTOs associated with the post.
     */
    comments?: CommentDto[];
  }
  
  /**
   * Data transfer object for updating an existing post.
   */
  export interface UpdatePostDto {
    /**
     * The new title of the post (optional).
     */
    title?: string;
    /**
     * The new content of the post (optional).
     */
    content?: string;
    /**
     * Optional array of new attachment IDs.
     */
    attachments?: string[];
  }
  
  /**
   * Data transfer object for searching posts.
   */
  export interface SearchPostDto {
    /**
     * The title to search for (optional).
     */
    title?: string;
    /**
     * The content to search for (optional).
     */
    content?: string;
    /**
     * The user ID to filter by (optional).
     */
    userId?: string;
    /**
     * The profile ID to filter by (optional).
     */
    profileId?: string;
  }

  /**
   * Options for searching posts.
   */
  export interface SearchPostOptions {
    /**
     * The field to order by (createdAt or updatedAt).
     */
    orderBy?: 'createdAt' | 'updatedAt';
    /**
     * The direction of the order (asc or desc).
     */
    orderDirection?: 'asc' | 'desc';
    /**
     * The maximum number of results to return.
     */
    limit?: number;
    /**
     * The number of results to skip.
     */
    offset?: number;
  }