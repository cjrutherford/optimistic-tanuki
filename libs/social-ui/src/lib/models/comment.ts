/**
 * Data transfer object for creating a new comment.
 */
export interface CreateCommentDto {
    /**
     * The content of the comment.
     */
    content: string;
    /**
     * The ID of the post to which the comment belongs.
     */
    postId: string;
    /**
     * The ID of the profile that created the comment.
     */
    profileId: string;
    /**
     * The ID of the parent comment, if this is a reply (optional).
     */
    parentId?: string;
  }
  
  /**
   * Data transfer object for a comment.
   */
  export interface CommentDto {
    /**
     * The unique identifier of the comment.
     */
    id: string;
    /**
     * The content of the comment.
     */
    content: string;
    /**
     * The ID of the post to which the comment belongs.
     */
    postId: string;
    /**
     * The ID of the user who created the comment.
     */
    userId: string;
    /**
     * The ID of the parent comment, if this is a reply (optional).
     */
    parentId?: string;
    /**
     * The ID of the profile that created the comment.
     */
    profileId: string;
  }
  
  /**
   * Data transfer object for updating an existing comment.
   */
  export interface UpdateCommentDto {
    /**
     * The new content of the comment (optional).
     */
    content?: string;
  }
  
  /**
   * Data transfer object for searching comments.
   */
  export interface SearchCommentDto {
    /**
     * The content of the comment to search for (optional).
     */
    content?: string;
    /**
     * The ID of the post to which the comment belongs (optional).
     */
    postId?: string;
    /**
     * The ID of the user who created the comment (optional).
     */
    userId?: string;
  }