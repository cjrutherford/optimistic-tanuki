export interface VoteDto {
  id: string;
  userId: string;
  profileId: string;
  itemId: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVoteDto {
  userId?: string;
  profileId?: string;
  itemId: string;
  value: number;
}
