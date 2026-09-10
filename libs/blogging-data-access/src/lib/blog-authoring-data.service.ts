import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export const BLOGGING_API_BASE_URL = new InjectionToken<string>(
  'BLOGGING_API_BASE_URL',
  { providedIn: 'root', factory: () => '/api' }
);

export interface BlogAuthoringCatalog {
  id: string;
  name: string;
  description?: string | null;
}

export interface BlogAuthoringPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
  isDraft: boolean;
  publishedAt?: string | Date | null;
}

export interface CreateBlogAuthoringPost {
  title: string;
  content: string;
  authorId: string;
  selectedCatalogId: string;
  isDraft?: boolean;
}

export interface BlogAuthoringWorkspace {
  workspaceId: string;
  workspaceSlug: string;
  appScope: string;
}

const BLOG_AUTHORING_APP_SCOPES = new Set([
  'configurable-client',
  'business-site',
]);

/** HTTP boundary for workspace-owned Blog authoring. */
@Injectable({ providedIn: 'root' })
export class BlogAuthoringDataService {
  private readonly apiUrl: string;

  constructor(
    @Inject(BLOGGING_API_BASE_URL) apiBaseUrl: string,
    private readonly http: HttpClient
  ) {
    this.apiUrl = apiBaseUrl;
  }

  listCatalogs(
    workspace: BlogAuthoringWorkspace
  ): Observable<BlogAuthoringCatalog[]> {
    this.assertWorkspace(workspace);
    return this.http.get<BlogAuthoringCatalog[]>(
      `${this.apiUrl}/blog/catalogs/mine`,
      {
        params: this.workspaceParams(workspace),
        headers: this.workspaceHeaders(workspace),
      }
    );
  }

  createCatalog(
    workspace: BlogAuthoringWorkspace,
    name: string,
    description?: string
  ): Observable<BlogAuthoringCatalog> {
    this.assertWorkspace(workspace);
    return this.http.post<BlogAuthoringCatalog>(
      `${this.apiUrl}/blog/catalogs`,
      { name, ...(description ? { description } : {}) },
      {
        params: this.workspaceParams(workspace),
        headers: this.workspaceHeaders(workspace),
      }
    );
  }

  listPosts(
    workspace: BlogAuthoringWorkspace,
    catalogId: string
  ): Observable<BlogAuthoringPost[]> {
    this.assertWorkspace(workspace);
    return this.http.get<BlogAuthoringPost[]>(
      `${this.apiUrl}/blog/catalogs/${encodeURIComponent(catalogId)}/posts`,
      {
        params: this.workspaceParams(workspace),
        headers: this.workspaceHeaders(workspace),
      }
    );
  }

  createPost(
    workspace: BlogAuthoringWorkspace,
    post: CreateBlogAuthoringPost
  ): Observable<BlogAuthoringPost> {
    this.assertWorkspace(workspace);
    return this.http.post<BlogAuthoringPost>(
      `${this.apiUrl}/post`,
      { ...post, isDraft: post.isDraft ?? true },
      {
        params: this.workspaceParams(workspace),
        headers: this.workspaceHeaders(workspace),
      }
    );
  }

  publishPost(
    workspace: BlogAuthoringWorkspace,
    postId: string
  ): Observable<BlogAuthoringPost> {
    this.assertWorkspace(workspace);
    return this.http.post<BlogAuthoringPost>(
      `${this.apiUrl}/post/${encodeURIComponent(postId)}/publish`,
      {},
      {
        params: this.workspaceParams(workspace),
        headers: this.workspaceHeaders(workspace),
      }
    );
  }

  private workspaceParams(workspace: BlogAuthoringWorkspace): HttpParams {
    return new HttpParams().set(
      'workspaceSlug',
      this.requireWorkspaceSlug(workspace)
    );
  }

  private workspaceHeaders(workspace: BlogAuthoringWorkspace): HttpHeaders {
    return new HttpHeaders({
      'x-ot-appscope': this.requireAppScope(workspace),
      'X-ot-workspace-id': workspace.workspaceId.trim(),
    });
  }

  private assertWorkspace(workspace: BlogAuthoringWorkspace): void {
    if (!workspace?.workspaceId?.trim()) {
      throw new Error('Blog authoring requires a workspaceId');
    }
    this.requireWorkspaceSlug(workspace);
    this.requireAppScope(workspace);
  }

  private requireWorkspaceSlug(workspace: BlogAuthoringWorkspace): string {
    if (!workspace?.workspaceSlug?.trim()) {
      throw new Error('Blog authoring requires a workspaceSlug');
    }
    return workspace.workspaceSlug.trim();
  }

  private requireAppScope(workspace: BlogAuthoringWorkspace): string {
    const appScope = workspace?.appScope?.trim();
    if (!appScope) {
      throw new Error('Blog authoring requires an appScope');
    }
    if (!BLOG_AUTHORING_APP_SCOPES.has(appScope)) {
      throw new Error(`Blog authoring does not support appScope ${appScope}`);
    }
    return appScope;
  }
}
