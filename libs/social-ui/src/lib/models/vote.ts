/**
 * Data transfer object for creating a new vote.
 */
export interface CreateVoteDto {
    /**
     * The value of the vote (e.g., 1 for upvote, -1 for downvote).
     */
    value: number;
    /**
     * The ID of the post to which the vote belongs.
     */
    postId: string;
  }
  
  /**
   * Data transfer object for a vote.
   */
  export interface VoteDto {
    /**
     * The unique identifier of the vote.
     */
    id: string;
    /**
     * The value of the vote.
     */
    value: number;
    /**
     * The ID of the post to which the vote belongs.
     */
    postId: string;
    /**
     * The ID of the user who cast the vote.
     */
    userId: string;
  }