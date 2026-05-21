import type { Meta, StoryObj } from '@storybook/angular';
import { GlobalSearchComponent, SearchService } from '@optimistic-tanuki/search-ui';
import { Observable, of } from 'rxjs';

class StorySearchService {
  search(): Observable<any> {
    return of({
      users: [{ id: '1', type: 'user', title: 'Ari Stone', subtitle: 'DX Lead' }],
      communities: [],
      posts: [
        {
          id: 'post-1',
          type: 'post',
          title: 'Validation Sweep',
          subtitle: 'Personality audit',
        },
      ],
      total: 2,
    });
  }

  getTrending(): Observable<any[]> {
    return of([]);
  }

  getSuggestedUsers(): Observable<any[]> {
    return of([]);
  }

  getSuggestedCommunities(): Observable<any[]> {
    return of([]);
  }
}

const meta: Meta<GlobalSearchComponent> = {
  component: GlobalSearchComponent,
  title: 'Theme/Personality Showcase/Search UI',
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      ...story(),
      providers: [{ provide: SearchService, useClass: StorySearchService }],
    }),
  ],
};

export default meta;
type Story = StoryObj<GlobalSearchComponent>;

export const Showcase: Story = {
  render: () => ({
    template: `
      <div style="padding: 24px; background: var(--background, #fff); color: var(--foreground, #000);">
        <search-global-search></search-global-search>
      </div>
    `,
  }),
};
