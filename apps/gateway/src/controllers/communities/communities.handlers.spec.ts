import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import {
  AppScopeCommands,
  CommunityCommands,
  RoleCommands,
} from '@optimistic-tanuki/constants';
import { CommunityMembershipStatus } from '@optimistic-tanuki/models';
import { CommunitiesController } from './communities.controller';

/**
 * The spec beside this one asserts the guard/permission metadata. These invoke
 * the handlers: what each sends to the social service, and which failures are
 * swallowed into an empty result versus rethrown.
 */
describe('Gateway CommunitiesController handlers', () => {
  let controller: CommunitiesController;
  let social: { send: jest.Mock };
  let permissions: { send: jest.Mock };
  let workspace: { send: jest.Mock };

  const user = { userId: 'user-1', profileId: 'profile-1' } as never;

  const sendResolves = (value: unknown) =>
    social.send.mockReturnValue(of(value));
  const sendRejects = () =>
    social.send.mockReturnValue(throwError(() => new Error('downstream')));

  const lastPayload = () => social.send.mock.calls.at(-1)?.[1];
  const lastPattern = () => social.send.mock.calls.at(-1)?.[0];

  beforeEach(() => {
    social = { send: jest.fn().mockReturnValue(of(null)) };
    permissions = {
      send: jest.fn((pattern: { cmd: string }) => {
        if (pattern.cmd === AppScopeCommands.GetByName) {
          return of({ id: 'workspace-scope-1' });
        }
        if (pattern.cmd === RoleCommands.GetByName) {
          return of({ id: 'community-owner-role-1' });
        }
        return of({ id: 'assignment-1' });
      }),
    };
    workspace = {
      send: jest.fn().mockReturnValue(
        of({
          workspaceId: '00000000-0000-4000-8000-000000000001',
          status: 'active',
        })
      ),
    };

    controller = new CommunitiesController(
      social as unknown as ClientProxy,
      permissions as unknown as ClientProxy,
      workspace as unknown as ClientProxy
    );

    // Silence the per-instance logger rather than the console.
    (
      controller as unknown as {
        logger: { debug: jest.Mock; error: jest.Mock; warn: jest.Mock };
      }
    ).logger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as never;
  });

  afterEach(() => jest.restoreAllMocks());

  describe('listCommunities', () => {
    it('passes the caller app scope through', async () => {
      sendResolves([{ id: 'c-1',appScope:'local-hub',isPrivate:false },{id:'private',appScope:'local-hub',isPrivate:true},{id:'unknown'},{id:'wrong-scope',appScope:'social',isPrivate:false}]);

      const result = await controller.listCommunities('local-hub', 'city');

      expect(lastPattern()).toEqual({ cmd: CommunityCommands.LIST_LOCALITY });
      expect(lastPayload()).toEqual({
        appScope: 'local-hub',
        localityType: 'city',
      });
      expect(result).toEqual([{ id: 'c-1',appScope:'local-hub',isPrivate:false }]);
    });

    it('drops the scope for the owner console so it sees every community', async () => {
      sendResolves([{id:'private',isPrivate:true}]);

      permissions.send.mockReturnValue(of([{role:{name:'owner_console_owner'}}]));
      const result=await controller.listCommunities('owner-console',undefined,{user:{profileId:'profile-1'}});
      expect(result).toEqual([{id:'private',isPrivate:true}]);

      expect(lastPayload()).toEqual({
        appScope: undefined,
        localityType: undefined,
      });
    });

    it('rejects a forged owner-console scope before calling Social', async () => {
      await expect(controller.listCommunities('owner-console',undefined,{})).rejects.toMatchObject({status:403});
      expect(social.send).not.toHaveBeenCalled();
      permissions.send.mockReturnValue(of([]));
      await expect(controller.listCommunities('owner-console',undefined,{user:{profileId:'profile-1'}})).rejects.toMatchObject({status:403});
      expect(social.send).not.toHaveBeenCalled();
      permissions.send.mockReturnValue(throwError(()=>new Error('offline')));
      await expect(controller.listCommunities('owner-console',undefined,{user:{profileId:'profile-1'}})).rejects.toMatchObject({status:503});
      expect(social.send).not.toHaveBeenCalled();
    });
    it('does not list across scopes when the caller supplies no scope', async () => {
      await expect(controller.listCommunities(null as any)).resolves.toEqual([]);
      expect(social.send).not.toHaveBeenCalled();
    });

    it('returns an empty list when the service fails', async () => {
      sendRejects();

      await expect(controller.listCommunities('local-hub')).resolves.toEqual(
        []
      );
    });
  });

  describe('getMyCommunities', () => {
    it('returns nothing for an anonymous caller without calling the service', async () => {
      const result = await controller.getMyCommunities({});

      expect(result).toEqual([]);
      expect(social.send).not.toHaveBeenCalled();
    });

    it('reads the user id from the guard-verified request', async () => {
      sendResolves([{ id: 'c-1' }]);

      const result = await controller.getMyCommunities({
        user: { userId: 'user-1' },
      });

      expect(lastPattern()).toEqual({
        cmd: CommunityCommands.GET_USER_COMMUNITIES,
      });
      expect(lastPayload()).toEqual({ userId: 'user-1' });
      expect(result).toEqual([{ id: 'c-1' }]);
    });

    it('returns an empty list when the service fails', async () => {
      sendRejects();

      await expect(
        controller.getMyCommunities({ user: { userId: 'user-1' } })
      ).resolves.toEqual([]);
    });
  });

  describe('reads that degrade to empty', () => {
    it('getSubCommunities returns an empty list on failure', async () => {
      social.send.mockReturnValueOnce(of({id:'c-1',isPrivate:false,appScope:'local-hub'})).mockReturnValueOnce(of([{id:'sub-1',isPrivate:false,appScope:'local-hub'},{id:'hidden',isPrivate:true,appScope:'local-hub'},{id:'other',isPrivate:false,appScope:'social'}])).mockReturnValueOnce(of({id:'c-1',isPrivate:false,appScope:'local-hub'}));
      await expect(controller.getSubCommunities('c-1','local-hub')).resolves.toEqual([
        { id:'sub-1',isPrivate:false,appScope:'local-hub' },
      ]);

      sendRejects();
      await expect(controller.getSubCommunities('c-1','local-hub')).resolves.toEqual([]);
    });
    it('never lists children for a private parent or one that becomes private in flight', async () => {
      social.send.mockReturnValueOnce(of({id:'c-1',isPrivate:true,appScope:'local-hub'}));
      await expect(controller.getSubCommunities('c-1','local-hub')).resolves.toEqual([]);
      social.send.mockReset().mockReturnValueOnce(of({id:'c-1',isPrivate:false,appScope:'local-hub'})).mockReturnValueOnce(of([{id:'sub-1',isPrivate:false,appScope:'local-hub'}])).mockReturnValueOnce(of({id:'c-1',isPrivate:true,appScope:'local-hub'}));
      await expect(controller.getSubCommunities('c-1','local-hub')).resolves.toEqual([]);
    });
  });

  describe('privacy-aware public manager and election reads', () => {
    const publicTown={id:'c-1',isPrivate:false,appScope:'local-hub'};
    for(const method of ['getCommunityManager','getCommunityElection'] as const) {
      it(`${method} serves only a current public in-scope community`,async()=>{
        social.send.mockReturnValueOnce(of(publicTown)).mockReturnValueOnce(of({id:'result'})).mockReturnValueOnce(of(publicTown));
        await expect(controller[method]('c-1','local-hub')).resolves.toEqual({id:'result'});
        social.send.mockReset().mockReturnValueOnce(of({...publicTown,isPrivate:true}));
        await expect(controller[method]('c-1','local-hub')).resolves.toBeNull();
        social.send.mockReset().mockReturnValueOnce(of(publicTown)).mockReturnValueOnce(of({id:'result'})).mockReturnValueOnce(of({...publicTown,isPrivate:true}));
        await expect(controller[method]('c-1','local-hub')).resolves.toBeNull();
        social.send.mockReset().mockReturnValueOnce(of({...publicTown,appScope:'other'}));
        await expect(controller[method]('c-1','local-hub')).resolves.toBeNull();
        await expect(controller[method]('c-1',undefined)).resolves.toBeNull();
      });
      it(`${method} permits a current member to read a private community`,async()=>{
        const privateTown={...publicTown,isPrivate:true};
        social.send.mockReturnValueOnce(of(privateTown)).mockReturnValueOnce(of(true)).mockReturnValueOnce(of({id:'result'})).mockReturnValueOnce(of(privateTown)).mockReturnValueOnce(of(true));
        await expect(controller[method]('c-1','local-hub',{user:{userId:'member'}})).resolves.toEqual({id:'result'});
        social.send.mockReset().mockReturnValueOnce(of(privateTown)).mockReturnValueOnce(of(false));
        await expect(controller[method]('c-1','local-hub',{user:{userId:'outsider'}})).resolves.toBeNull();
      });
      it(`${method} requires a verified owner role for cross-scope access`,async()=>{
        await expect(controller[method]('c-1','owner-console')).rejects.toMatchObject({status:403});
        permissions.send.mockReturnValueOnce(of([]));
        await expect(controller[method]('c-1','owner-console',{user:{profileId:'p'}})).rejects.toMatchObject({status:403});
        permissions.send.mockReturnValueOnce(of([{role:{name:'owner_console_owner'}}]));
        social.send.mockReturnValueOnce(of({id:'result'}));
        await expect(controller[method]('c-1','owner-console',{user:{profileId:'p'}})).resolves.toEqual({id:'result'});
      });
    }
  });

  describe('leaveCommunity', () => {
    it('sends the leave for the caller', async () => {
      sendResolves(undefined);

      await controller.leaveCommunity('c-1', user, 'local-hub');

      const leaveCall = social.send.mock.calls.find(
        (call) => call[0]?.cmd === CommunityCommands.LEAVE
      );
      expect(leaveCall?.[1]).toEqual({
        communityId: 'c-1',
        userId: 'user-1',
      });
    });
  });
});
