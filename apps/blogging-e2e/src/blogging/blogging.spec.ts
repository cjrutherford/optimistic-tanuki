import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import {
  BlogPostCommands,
  EventCommands,
  ContactCommands,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Blogging Microservice E2E', () => {
  let bloggingClient: ClientProxy;
  let createdPostId: string;
  let createdEventId: string;
  let testAuthorId: string;

  beforeAll(async () => {
    // Create a client proxy to connect to the blogging microservice
    bloggingClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: globalThis.socketConnectionOptions?.host || '127.0.0.1',
        port: globalThis.socketConnectionOptions?.port || 3011,
      },
    });

    // Connect to the microservice
    await bloggingClient.connect();
  });

  afterAll(async () => {
    // Close the connection
    await bloggingClient.close();
  });

  describe('Blog Post Operations', () => {
    describe('Create Post', () => {
      it('should create a new blog post', async () => {
        testAuthorId = `test-author-${Date.now()}`;
        const testPost = {
          title: `Test Blog Post ${Date.now()}`,
          content: 'This is test blog post content for E2E testing',
          authorId: testAuthorId,
          isDraft: true,
        };

        const result = await firstValueFrom(
          bloggingClient.send({ cmd: BlogPostCommands.CREATE }, testPost)
        );

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.title).toBe(testPost.title);
        expect(result.content).toBe(testPost.content);

        createdPostId = result.id;
      });

      it('should create a published blog post', async () => {
        const testPost = {
          title: `Published Test Post ${Date.now()}`,
          content: 'Published content',
          authorId: `test-author-${Date.now()}`,
          isDraft: false,
        };

        const result = await firstValueFrom(
          bloggingClient.send({ cmd: BlogPostCommands.CREATE }, testPost)
        );

        expect(result).toBeDefined();
        expect(result.isDraft).toBe(false);
      });
    });

    describe('Find Posts', () => {
      it('should find a post by id', async () => {
        const result = await firstValueFrom(
          bloggingClient.send(
            { cmd: BlogPostCommands.FIND },
            {
              id: createdPostId,
            }
          )
        );

        expect(result).toBeDefined();
        expect(result.id).toBe(createdPostId);
      });

      it('should find all posts', async () => {
        const result = await firstValueFrom(
          bloggingClient.send({ cmd: BlogPostCommands.FIND_ALL }, {})
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });

      it('should find published posts', async () => {
        const result = await firstValueFrom(
          bloggingClient.send({ cmd: BlogPostCommands.FIND_PUBLISHED }, {})
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('Update Post', () => {
      it('should update a blog post', async () => {
        const result = await firstValueFrom(
          bloggingClient.send(
            { cmd: BlogPostCommands.UPDATE },
            {
              id: createdPostId,
              updatePostDto: {
                title: 'Updated Blog Post Title',
                content: 'Updated content',
                isDraft: false,
              },
              requestingAuthorId: testAuthorId,
            }
          )
        );

        expect(result).toBeDefined();
        expect(result.title).toBe('Updated Blog Post Title');
        expect(result.isDraft).toBe(false);
      });
    });

    describe('Delete Post', () => {
      it('should delete a blog post', async () => {
        const result = await firstValueFrom(
          bloggingClient.send(
            { cmd: BlogPostCommands.DELETE },
            {
              id: createdPostId,
            }
          ),
          { defaultValue: null }
        );

        // expect(result).toBeDefined();
      });

      it('should return null when finding deleted post', async () => {
        const result = await firstValueFrom(
          bloggingClient.send(
            { cmd: BlogPostCommands.FIND },
            {
              id: createdPostId,
            }
          )
        );

        expect(result).toBeNull();
      });
    });
  });

  describe('Event Operations', () => {
    describe('Create Event', () => {
      it('should create a new event', async () => {
        const testEvent = {
          name: `Test Event ${Date.now()}`,
          description: 'Test event description',
          startTime: new Date(),
          endTime: new Date(Date.now() + 86400000), // +1 day
          location: 'Test Location',
          organizerId: testAuthorId,
        };

        const result = await firstValueFrom(
          bloggingClient.send({ cmd: EventCommands.CREATE }, testEvent)
        );

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.name).toBe(testEvent.name);

        createdEventId = result.id;
      });
    });

    describe('Find Events', () => {
      it('should find an event by id', async () => {
        const result = await firstValueFrom(
          bloggingClient.send(
            { cmd: EventCommands.FIND },
            {
              id: createdEventId,
            }
          )
        );

        expect(result).toBeDefined();
        expect(result.id).toBe(createdEventId);
      });

      it('should find all events', async () => {
        const result = await firstValueFrom(
          bloggingClient.send({ cmd: EventCommands.FIND_ALL }, {})
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('Update Event', () => {
      it('should update an event', async () => {
        const result = await firstValueFrom(
          bloggingClient.send(
            { cmd: EventCommands.UPDATE },
            {
              id: createdEventId,
              updateEventDto: {
                name: 'Updated Event Title',
                location: 'Updated Location',
              },
            }
          )
        );

        expect(result).toBeDefined();
        expect(result.name).toBe('Updated Event Title');
      });
    });

    describe('Delete Event', () => {
      it('should delete an event', async () => {
        const result = await firstValueFrom(
          bloggingClient.send(
            { cmd: EventCommands.DELETE },
            {
              id: createdEventId,
            }
          ),
          { defaultValue: null }
        );
      });
    });
  });
});
