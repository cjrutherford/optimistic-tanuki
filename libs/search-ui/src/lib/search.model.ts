export type SearchType = 'all' | 'users' | 'posts' | 'communities';

export interface SearchResult {
  type: 'user' | 'post' | 'community';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  highlight?: string;
}

export interface SearchResponse {
  users: SearchResult[];
  posts: SearchResult[];
  communities: SearchResult[];
  total: number;
}

export interface SearchOptions {
  type?: SearchType;
  limit?: number;
  offset?: number;
}

export interface SearchHistory {
  id: string;
  profileId: string;
  query: string;
  searchType: SearchType;
  resultCount: number;
  createdAt: Date;
}
