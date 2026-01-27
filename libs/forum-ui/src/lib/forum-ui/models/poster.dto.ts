
export interface PosterDto {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    role: 'user' | 'moderator' | 'admin';
    joinedAt: Date;
}

export interface PosterStatsDto {
    postsCount: number;
    topicsCount: number;
    likesReceived: number;
}
