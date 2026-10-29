import { Logger } from '@nestjs/common';
import { of } from 'rxjs';
import {
  PostCommands,
  ServiceTokens,
  SocialComponentCommands,
} from '@optimistic-tanuki/constants';
import { SocialComponentController } from './social-component.controller';

describe('SocialComponentController privacy boundary', () => {
  const post = { id: 'private-post', content: 'private' };
  const component = {
    id: 'component-1',
    postId: post.id,
    componentData: { secret: true },
  };
  let client: { send: jest.Mock; connect: jest.Mock };
  let controller: SocialComponentController;

  beforeEach(() => {
    client = {
      send: jest.fn((pattern, payload) => {
        if (pattern?.cmd === PostCommands.FIND) {
          return of(payload.viewerProfileId === 'member' ? post : null);
        }
        if (pattern?.cmd === SocialComponentCommands.FIND_BY_POST) {
          return of([component]);
        }
        if (pattern?.cmd === SocialComponentCommands.FIND) return of(component);
        return of([]);
      }),
      connect: jest.fn().mockResolvedValue(undefined),
    };
    controller = new SocialComponentController(client as any, new Logger());
  });

  it('returns components for an authorized parent post', async () => {
    await expect(
      controller.getSocialComponents(post.id, { user: { profileId: 'member' } })
    ).resolves.toEqual([component]);
    expect(client.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND },
      { id: post.id, viewerProfileId: 'member' }
    );
  });

  it('does not return components when the parent post is inaccessible', async () => {
    await expect(
      controller.getSocialComponents(post.id, {
        user: { profileId: 'outsider' },
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('checks the parent before returning a component by id', async () => {
    await expect(
      controller.getSocialComponent(component.id, {
        user: { profileId: 'outsider' },
      })
    ).rejects.toMatchObject({ status: 404 });
    expect(client.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND },
      { id: post.id, viewerProfileId: 'outsider' }
    );
  });
});
