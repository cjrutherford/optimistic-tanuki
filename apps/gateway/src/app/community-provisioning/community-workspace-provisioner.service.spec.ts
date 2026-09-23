import { of } from 'rxjs';
import { CommunityWorkspaceProvisioner } from './community-workspace-provisioner.service';

describe('CommunityWorkspaceProvisioner (G2a shared saga core)', () => {
  const workspaceClient = { send: jest.fn() };
  const permissionsClient = { send: jest.fn() };
  let provisioner: CommunityWorkspaceProvisioner;

  const user = { userId: 'user-1', profileId: 'profile-1' } as any;
  const community = {
    id: 'community-1',
    slug: 'north-star',
    name: 'North Star',
  };

  beforeEach(() => {
    workspaceClient.send.mockReset();
    permissionsClient.send.mockReset();
    workspaceClient.send
      .mockReturnValueOnce(
        of({ workspaceId: '00000000-0000-4000-8000-000000000001' })
      )
      .mockReturnValueOnce(
        of({ workspaceId: '00000000-0000-4000-8000-000000000001' })
      );
    permissionsClient.send
      .mockReturnValueOnce(of(null))
      .mockReturnValueOnce(of({ id: 'scope-1' }))
      .mockReturnValueOnce(of({ id: 'role-1' }))
      .mockReturnValueOnce(of({ assigned: true }));
    provisioner = new CommunityWorkspaceProvisioner(
      workspaceClient as any,
      permissionsClient as any
    );
  });

  it('registers and activates the workspace, ensures scope, assigns owner role', async () => {
    await provisioner.provision(community, user, 'local-hub');

    expect(workspaceClient.send).toHaveBeenNthCalledWith(
      1,
      'workspace.register',
      expect.objectContaining({
        kind: 'community',
        slug: 'north-star',
        ownerUserId: 'user-1',
        ownerProfileId: 'profile-1',
      })
    );
    expect(workspaceClient.send).toHaveBeenNthCalledWith(
      2,
      'workspace.activate',
      expect.objectContaining({
        workspaceId: '00000000-0000-4000-8000-000000000001',
      })
    );
    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: 'Assign:Role' },
      { roleId: 'role-1', profileId: 'profile-1', appScopeId: 'scope-1' }
    );
  });

  it('fails closed when owner permissions are not configured', async () => {
    permissionsClient.send.mockReset();
    permissionsClient.send
      .mockReturnValueOnce(of(null))
      .mockReturnValueOnce(of({ id: 'scope-1' }))
      .mockReturnValueOnce(of(null));

    await expect(
      provisioner.provision(community, user, 'local-hub')
    ).rejects.toThrow(
      'Community workspace owner permissions are not configured'
    );
  });
});
