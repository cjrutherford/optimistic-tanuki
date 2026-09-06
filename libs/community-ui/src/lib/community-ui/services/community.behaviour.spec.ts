import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { CommunityService } from './community.service';
import {
  CommunityJoinPolicy,
  CommunityDto,
} from '@optimistic-tanuki/ui-models';

/**
 * Every method on the service is a thin HTTP wrapper, so each case declares the
 * call to make and the request it must produce. Keeping them in a table means a
 * renamed route or a dropped payload field fails a named case rather than
 * silently passing.
 */
interface RequestCase {
  readonly name: string;
  readonly invoke: (service: CommunityService) => Promise<unknown>;
  readonly method: string;
  readonly url: string;
  /** Expected request body; omitted for verbs that send none. */
  readonly body?: unknown;
  readonly respondWith: object | boolean | null;
  readonly expected: unknown;
}

const community: CommunityDto = {
  id: 'community-1',
  name: 'General',
  description: 'The general community.',
  ownerId: 'user-1',
  ownerProfileId: 'profile-1',
  appScope: 'social',
  isPrivate: false,
  joinPolicy: CommunityJoinPolicy.PUBLIC,
  tags: [],
  memberCount: 3,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const member = {
  id: 'member-1',
  communityId: 'community-1',
  userId: 'user-2',
  profileId: 'profile-2',
  role: 'member',
  status: 'approved',
  joinedAt: new Date('2026-01-03T00:00:00.000Z'),
};

const invite = {
  id: 'invite-1',
  communityId: 'community-1',
  invitedProfileId: 'profile-3',
  invitedByProfileId: 'profile-1',
  status: 'pending',
};

const chatMessage = {
  id: 'message-1',
  conversationId: 'room-1',
  senderId: 'profile-1',
  content: 'hello',
  type: 'chat' as const,
  recipients: ['profile-2'],
  createdAt: new Date('2026-01-04T00:00:00.000Z'),
};

const cases: RequestCase[] = [
  {
    name: 'create opts the new community into a chat room',
    invoke: (service) => service.create({ name: 'General' } as never),
    method: 'POST',
    url: '/api/social/community',
    body: { name: 'General', createChatRoom: true },
    respondWith: community,
    expected: community,
  },
  {
    name: 'findOne reads a community by id',
    invoke: (service) => service.findOne('community-1'),
    method: 'GET',
    url: '/api/social/community/community-1',
    respondWith: community,
    expected: community,
  },
  {
    name: 'findBySlug reads a community from the slug route',
    invoke: (service) => service.findBySlug('general'),
    method: 'GET',
    url: '/api/social/community/slug/general',
    respondWith: community,
    expected: community,
  },
  {
    name: 'findAll posts the search criteria to the search route',
    invoke: (service) => service.findAll({ name: 'gen' } as never),
    method: 'POST',
    url: '/api/social/community/search',
    body: { name: 'gen' },
    respondWith: [community],
    expected: [community],
  },
  {
    name: 'update puts the changed fields for a community',
    invoke: (service) =>
      service.update('community-1', { name: 'Renamed' } as never),
    method: 'PUT',
    url: '/api/social/community/community-1',
    body: { name: 'Renamed' },
    respondWith: { ...community, name: 'Renamed' },
    expected: { ...community, name: 'Renamed' },
  },
  {
    name: 'delete removes a community',
    invoke: (service) => service.delete('community-1'),
    method: 'DELETE',
    url: '/api/social/community/community-1',
    respondWith: null,
    expected: null,
  },
  {
    name: 'join posts the join dto to the community join route',
    invoke: (service) =>
      service.join('community-1', { communityId: 'community-1' } as never),
    method: 'POST',
    url: '/api/social/community/community-1/join',
    body: { communityId: 'community-1' },
    respondWith: member,
    expected: member,
  },
  {
    name: 'leave deletes the current membership',
    invoke: (service) => service.leave('community-1'),
    method: 'DELETE',
    url: '/api/social/community/community-1/leave',
    respondWith: null,
    expected: null,
  },
  {
    name: 'getMembers lists the community members',
    invoke: (service) => service.getMembers('community-1'),
    method: 'GET',
    url: '/api/social/community/community-1/members',
    respondWith: [member],
    expected: [member],
  },
  {
    name: 'getUserCommunities reads the communities of the signed in user',
    invoke: (service) => service.getUserCommunities(),
    method: 'GET',
    url: '/api/social/community/user/communities',
    respondWith: [community],
    expected: [community],
  },
  {
    name: 'getMember reads a single membership',
    invoke: (service) => service.getMember('community-1', 'profile-2'),
    method: 'GET',
    url: '/api/social/community/community-1/member/profile-2',
    respondWith: member,
    expected: member,
  },
  {
    name: 'isMember asks the membership check route',
    invoke: (service) => service.isMember('community-1', 'profile-2'),
    method: 'GET',
    url: '/api/social/community/community-1/is-member/profile-2',
    respondWith: true,
    expected: true,
  },
  {
    name: 'invite posts the invitation dto',
    invoke: (service) =>
      service.invite({
        communityId: 'community-1',
        profileId: 'profile-3',
      } as never),
    method: 'POST',
    url: '/api/social/community/invite',
    body: { communityId: 'community-1', profileId: 'profile-3' },
    respondWith: invite,
    expected: invite,
  },
  {
    name: 'cancelInvite deletes the invitation by id',
    invoke: (service) => service.cancelInvite('invite-1'),
    method: 'DELETE',
    url: '/api/social/community/invite/invite-1',
    respondWith: null,
    expected: null,
  },
  {
    name: 'getPendingInvites lists outstanding invitations',
    invoke: (service) => service.getPendingInvites('community-1'),
    method: 'GET',
    url: '/api/social/community/community-1/invites',
    respondWith: [invite],
    expected: [invite],
  },
  {
    name: 'getPendingJoinRequests lists outstanding join requests',
    invoke: (service) => service.getPendingJoinRequests('community-1'),
    method: 'GET',
    url: '/api/social/community/community-1/join-requests',
    respondWith: [{ ...member, status: 'pending' }],
    expected: [{ ...member, status: 'pending' }],
  },
  {
    name: 'approveMember posts an empty body to the approve route',
    invoke: (service) => service.approveMember('member-1'),
    method: 'POST',
    url: '/api/social/community/members/member-1/approve',
    body: {},
    respondWith: member,
    expected: member,
  },
  {
    name: 'rejectMember posts an empty body to the reject route',
    invoke: (service) => service.rejectMember('member-1'),
    method: 'POST',
    url: '/api/social/community/members/member-1/reject',
    body: {},
    respondWith: null,
    expected: null,
  },
  {
    name: 'removeMember sends the scoping payload as a delete body',
    invoke: (service) =>
      service.removeMember('member-1', {
        profileId: 'profile-2',
        communityId: 'community-1',
      }),
    method: 'DELETE',
    url: '/api/social/community/members/member-1',
    body: { profileId: 'profile-2', communityId: 'community-1' },
    respondWith: null,
    expected: null,
  },
  {
    name: 'removeMember sends no delete body when no payload is given',
    invoke: (service) => service.removeMember('member-1'),
    method: 'DELETE',
    url: '/api/social/community/members/member-1',
    body: null,
    respondWith: null,
    expected: null,
  },
  {
    name: 'getUserInvites lists the invitations addressed to a user',
    invoke: (service) => service.getUserInvites('user-2'),
    method: 'GET',
    url: '/api/social/community/user/user-2/invites',
    respondWith: [invite],
    expected: [invite],
  },
  {
    name: 'getTopActive falls back to the default limit and app scope',
    invoke: (service) => service.getTopActive(),
    method: 'GET',
    url: '/api/social/community/top-active?limit=10&appScope=social',
    respondWith: [community],
    expected: [community],
  },
  {
    name: 'getTopActive forwards an explicit limit and app scope',
    invoke: (service) => service.getTopActive(5, 'business'),
    method: 'GET',
    url: '/api/social/community/top-active?limit=5&appScope=business',
    respondWith: [community],
    expected: [community],
  },
  {
    name: 'getProfile reads a profile from the profile api',
    invoke: (service) => service.getProfile('profile-2'),
    method: 'GET',
    url: '/api/profile/profile-2',
    respondWith: { id: 'profile-2' },
    expected: { id: 'profile-2' },
  },
  {
    name: 'getProfilesByIds posts the ids to the bulk profile route',
    invoke: (service) => service.getProfilesByIds(['profile-2', 'profile-3']),
    method: 'POST',
    url: '/api/profile/by-ids',
    body: { ids: ['profile-2', 'profile-3'] },
    respondWith: [{ id: 'profile-2' }, { id: 'profile-3' }],
    expected: [{ id: 'profile-2' }, { id: 'profile-3' }],
  },
  {
    name: 'getCommunityPosts queries the newest posts for a community',
    invoke: (service) => service.getCommunityPosts('community-1'),
    method: 'POST',
    url: '/api/social/post/find',
    body: {
      criteria: { communityId: 'community-1' },
      opts: { orderBy: 'createdAt', orderDirection: 'desc', limit: 50 },
    },
    respondWith: [{ id: 'post-1' }],
    expected: [{ id: 'post-1' }],
  },
  {
    name: 'getCommunityChatRoom reads the chat room of a community',
    invoke: (service) => service.getCommunityChatRoom('community-1'),
    method: 'GET',
    url: '/api/social/community/community-1/chat-room',
    respondWith: { id: 'room-1' },
    expected: { id: 'room-1' },
  },
  {
    name: 'getCommunityChatConversation reads a conversation from the chat api',
    invoke: (service) => service.getCommunityChatConversation('room-1'),
    method: 'GET',
    url: '/api/chat/conversations/id/room-1',
    respondWith: { id: 'room-1', participants: ['profile-1'] },
    expected: { id: 'room-1', participants: ['profile-1'] },
  },
  {
    name: 'getCommunityChatMessages reads the messages of a conversation',
    invoke: (service) => service.getCommunityChatMessages('room-1'),
    method: 'GET',
    url: '/api/chat/messages/room-1',
    respondWith: [chatMessage],
    expected: [chatMessage],
  },
  {
    name: 'sendCommunityChatMessage posts the message payload unchanged',
    invoke: (service) =>
      service.sendCommunityChatMessage({
        conversationId: 'room-1',
        content: 'hello',
        senderId: 'profile-1',
        recipientIds: ['profile-2'],
      }),
    method: 'POST',
    url: '/api/chat/messages',
    body: {
      conversationId: 'room-1',
      content: 'hello',
      senderId: 'profile-1',
      recipientIds: ['profile-2'],
    },
    respondWith: chatMessage,
    expected: chatMessage,
  },
  {
    name: 'ensureCommunityChatRoom posts the owner and room name',
    invoke: (service) =>
      service.ensureCommunityChatRoom('community-1', 'profile-1', 'General'),
    method: 'POST',
    url: '/api/social/community/community-1/chat-room',
    body: { ownerId: 'profile-1', name: 'General' },
    respondWith: { id: 'room-1' },
    expected: { id: 'room-1' },
  },
  {
    name: 'getCommunityById reads a community by id',
    invoke: (service) => service.getCommunityById('community-1'),
    method: 'GET',
    url: '/api/social/community/community-1',
    respondWith: community,
    expected: community,
  },
  {
    name: 'createCommunityChatChannel posts the channel name',
    invoke: (service) =>
      service.createCommunityChatChannel('community-1', 'Moderators'),
    method: 'POST',
    url: '/api/social/community/community-1/chat-channels',
    body: { name: 'Moderators' },
    respondWith: { id: 'channel-1' },
    expected: { id: 'channel-1' },
  },
  {
    name: 'createPost posts the whole post payload to the social api',
    invoke: (service) =>
      service.createPost({
        title: 'Hi',
        content: 'Body',
        profileId: 'profile-1',
        communityId: 'community-1',
        attachmentIds: ['file-1'],
      }),
    method: 'POST',
    url: '/api/social/post',
    body: {
      title: 'Hi',
      content: 'Body',
      profileId: 'profile-1',
      communityId: 'community-1',
      attachmentIds: ['file-1'],
    },
    respondWith: { id: 'post-1' },
    expected: { id: 'post-1' },
  },
  {
    name: 'getCurrentUserProfile reads the signed in profile',
    invoke: (service) => service.getCurrentUserProfile(),
    method: 'GET',
    url: '/api/profile/me',
    respondWith: { id: 'profile-1' },
    expected: { id: 'profile-1' },
  },
  {
    name: 'appointManager posts the promoted profile id',
    invoke: (service) => service.appointManager('community-1', 'profile-2'),
    method: 'POST',
    url: '/api/social/community/community-1/managers',
    body: { profileId: 'profile-2' },
    respondWith: null,
    expected: null,
  },
  {
    name: 'revokeManager deletes the manager by profile id',
    invoke: (service) => service.revokeManager('community-1', 'profile-2'),
    method: 'DELETE',
    url: '/api/social/community/community-1/managers/profile-2',
    respondWith: null,
    expected: null,
  },
];

describe('CommunityService', () => {
  let service: CommunityService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CommunityService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CommunityService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it.each(cases)('$name', async (testCase) => {
    const pending = testCase.invoke(service);

    const request = http.expectOne(testCase.url);
    expect(request.request.method).toBe(testCase.method);
    if ('body' in testCase) {
      expect(request.request.body).toEqual(testCase.body);
    }

    request.flush(testCase.respondWith);

    await expect(pending).resolves.toEqual(testCase.expected);
  });

  it('rejects with the http error when a request fails', async () => {
    const pending = service.findOne('missing');

    http
      .expectOne('/api/social/community/missing')
      .flush(
        { message: 'Not found' },
        { status: 404, statusText: 'Not Found' }
      );

    await expect(pending).rejects.toEqual(
      expect.objectContaining({ status: 404, error: { message: 'Not found' } })
    );
  });
});
