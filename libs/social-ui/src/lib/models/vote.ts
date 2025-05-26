export interface CreateVoteDto {
    value: number;
    postId: string;
  }
  
  export interface VoteDto {
    id: string;
    value: number;
    postId: string;
    userId: string;
  }