import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OptomisitcTanukiAPIService } from '../generated/blogging';

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
  constructor(
    @Inject(BLOGGING_API_BASE_URL) _apiBaseUrl: string,
    private readonly blogging: OptomisitcTanukiAPIService
  ) {}

  listCatalogs(
    workspace: BlogAuthoringWorkspace
  ): Observable<BlogAuthoringCatalog[]> {
    this.assertWorkspace(workspace);
    return this.blogging.blogControllerFindMyCatalogs<BlogAuthoringCatalog[]>(
      this.requestOptions(workspace)
    );
  }

  createCatalog(
    workspace: BlogAuthoringWorkspace,
    name: string,
    description?: string
  ): Observable<BlogAuthoringCatalog> {
    this.assertWorkspace(workspace);
    return this.blogging.blogControllerCreateCatalog<BlogAuthoringCatalog>(
      { name, ...(description ? { description } : {}) },
      this.requestOptions(workspace)
    );
  }

  listPosts(
    workspace: BlogAuthoringWorkspace,
    catalogId: string
  ): Observable<BlogAuthoringPost[]> {
    this.assertWorkspace(workspace);
    return this.blogging.blogControllerFindCatalogPosts<BlogAuthoringPost[]>(
      catalogId,
      this.requestOptions(workspace)
    );
  }

  createPost(
    workspace: BlogAuthoringWorkspace,
    post: CreateBlogAuthoringPost
  ): Observable<BlogAuthoringPost> {
    this.assertWorkspace(workspace);
    return this.blogging.postControllerCreatePost<BlogAuthoringPost>(
      { ...post, isDraft: post.isDraft ?? true },
      this.requestOptions(workspace)
    );
  }

  publishPost(
    workspace: BlogAuthoringWorkspace,
    postId: string
  ): Observable<BlogAuthoringPost> {
    this.assertWorkspace(workspace);
    return this.blogging.postControllerPublishPost<BlogAuthoringPost>(
      postId,
      this.requestOptions(workspace)
    );
  }

  private requestOptions(workspace: BlogAuthoringWorkspace): {
    params: Record<string, string>;
    headers: Record<string, string>;
  } {
    // Plain records (not HttpParams): generated clients spread options into
    // the request params, which drops HttpParams internals.
    return {
      params: { workspaceSlug: this.requireWorkspaceSlug(workspace) },
      headers: {
        'x-ot-appscope': this.requireAppScope(workspace),
        'X-ot-workspace-id': workspace.workspaceId.trim(),
      },
    };
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
