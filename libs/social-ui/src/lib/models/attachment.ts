/**
 * Data transfer object for creating a new attachment.
 */
export interface CreateAttachmentDto {
    /**
     * The URL of the attachment.
     */
    url: string;
    /**
     * The ID of the post to which the attachment belongs.
     */
    postId: string;
  }
  
  /**
   * Data transfer object for an attachment.
   */
  export interface AttachmentDto {
    /**
     * The unique identifier of the attachment.
     */
    id: string;
    /**
     * The URL of the attachment.
     */
    url: string;
    /**
     * The name of the attachment.
     */
    name: string;
    /**
     * The MIME type of the attachment.
     */
    type: Blob["type"];
    /**
     * The ID of the post to which the attachment belongs.
     */
    postId: string;
    /**
     * The ID of the user who uploaded the attachment.
     */
    userId: string;
  }
  
  /**
   * Data transfer object for updating an existing attachment.
   */
  export interface UpdateAttachmentDto {
    /**
     * The new URL of the attachment (optional).
     */
    url?: string;
  }
  
  /**
   * Data transfer object for searching attachments.
   */
  export interface SearchAttachmentDto {
    /**
     * The URL of the attachment to search for (optional).
     */
    url?: string;
    /**
     * The ID of the post to which the attachment belongs (optional).
     */
    postId?: string;
    /**
     * The ID of the user who uploaded the attachment (optional).
     */
    userId?: string;
  }