export class UpdateFollowDto {
    followerId: string;
    followeeId: string;
}

export class QueryFollowsDto {
    followerId?: string;
    followeeId?: string;
    isMutual?: boolean;
}