import { of, type Observable } from 'rxjs';
import * as dataAccess from '../index';

type DiscoveredWorkspace = {
  workspaceId: string;
  kind: 'business-site' | 'community';
  slug: string;
  displayName: string;
  appScope: string;
  status: 'draft' | 'active' | 'suspended' | 'archived';
};

type WorkspaceDiscoveryApi = {
  list(): Observable<DiscoveredWorkspace[]>;
  get(workspaceId: string): Observable<DiscoveredWorkspace>;
  provisionBusinessSite(): Observable<unknown>;
};

type WorkspaceDiscoveryApiConstructor = new (http: {
  get: jest.Mock;
  post: jest.Mock;
}) => WorkspaceDiscoveryApi;

const { WorkspaceDiscoveryApiService } = dataAccess as unknown as {
  WorkspaceDiscoveryApiService: WorkspaceDiscoveryApiConstructor;
};

describe('WorkspaceDiscoveryApiService', () => {
  it('uses the Gateway workspace endpoint without caller-supplied ownership fields', () => {
    const http = {
      get: jest.fn().mockReturnValue(of([])),
      post: jest.fn().mockReturnValue(of({})),
    };
    const api = new WorkspaceDiscoveryApiService(http);

    api.list().subscribe();
    api.get('workspace north/star').subscribe();
    api.provisionBusinessSite().subscribe();

    expect(http.get).toHaveBeenNthCalledWith(1, '/api/workspaces');
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      '/api/workspaces/workspace%20north%2Fstar'
    );
    expect(http.post).toHaveBeenCalledWith(
      '/api/workspaces/business-sites/provision',
      {},
      { headers: { 'X-ot-appscope': 'business-site' } }
    );
  });
});
