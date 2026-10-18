export const ProfileCommands = {
  Create: 'Create:Profile',
  Update: 'Update:Profile',
  GetGuardian: 'Get:GuardianProfile',
  GetGuardianConsoleProfile: 'Get:GuardianConsoleProfile',
  UpdateGuardian: 'Update:GuardianProfile',
  Delete: 'Delete:Profile',
  Get: 'Get:Profile',
  GetAll: 'GetAll:Profile',
  Search: 'Search:Profile',
  GetPhoto: 'Get:ProfilePhoto',
  GetCover: 'Get:ProfileCover',
  SetBlogRole: 'Set:BlogRole',
  GetBlogRole: 'Get:BlogRole',
  GetAccountExportSnapshot: 'Get:AccountExportSnapshot',
  GetOwnedAccountProfileIdPage: 'Get:OwnedAccountProfileIdPage',
};

export interface OwnedAccountProfileIdPageRequest {
  accountId: string;
  token: string;
  appId: string;
  afterId?: string;
  limit: number;
}

export interface OwnedAccountProfileIdPage {
  accountId: string;
  profileIds: string[];
  hasMore: boolean;
  nextCursor: string | null;
  unfenced: true;
}

export const ProjectCommands = {
  Create: 'Create:Project',
  Update: 'Update:Project',
  Delete: 'Delete:Project',
  Get: 'Get:Project',
  GetAll: 'GetAll:Project',
};

export const GoalCommands = {
  Create: 'Create:Goal',
  Update: 'Update:Goal',
  Delete: 'Delete:Goal',
  Get: 'Get:Goal',
  GetAll: 'GetAll:Goal',
};

export const TimelineCommands = {
  Create: 'Create:Timeline',
  Update: 'Update:Timeline',
  Delete: 'Delete:Timeline',
  Get: 'Get:Timeline',
  GetAll: 'GetAll:Timeline',
};
