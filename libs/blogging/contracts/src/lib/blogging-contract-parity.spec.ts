import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  BlogCatalogCommands,
  BlogCommands,
  BlogComponentCommands,
  ContactCommands,
  BlogEventCommands,
  BlogPostCommands,
} from '../index';
import {
  CreateBlogCatalogDto,
  CreateBlogComponentDto,
  CreateBlogDto,
  CreateContactDto,
  CreateBlogEventDto,
  CreateBlogPostDto,
} from '../index';

/**
 * Covered creation patterns with their contract DTO plus one valid and one
 * invalid sample. Read/update/delete/query patterns take `{id}`/scope,
 * `FindManyOptions`, or query DTOs (verified uniform across the blogging
 * controllers) and are complete by definition — listed in SCALAR_OR_EMPTY.
 * Post publish/RSS/SEO/search and sitemap generation are follow-up slices
 * (DEFERRED).
 */
const COVERED: Array<{
  pattern: string;
  dto: new () => object;
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
  invalidProps: string[];
}> = [
  {
    pattern: BlogCommands.CREATE,
    dto: CreateBlogDto,
    valid: {
      name: 'Engineering',
      description: 'Eng blog',
      ownerId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
    },
    invalid: {
      description: 'Eng blog',
      ownerId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
    },
    invalidProps: ['name'],
  },
  {
    pattern: BlogCatalogCommands.CREATE,
    dto: CreateBlogCatalogDto,
    valid: { name: 'Tech' },
    invalid: {},
    invalidProps: ['name'],
  },
  {
    pattern: ContactCommands.CREATE,
    dto: CreateContactDto,
    valid: {
      name: 'Ada Lovelace',
      message: 'Hello, I love your blog!',
      email: 'ada@example.com',
      phone: '+10000000000',
    },
    invalid: {
      name: 'Ada',
      message: 'Hello, I love your blog!',
      phone: '+10000000000',
    },
    invalidProps: ['email'],
  },
  {
    pattern: BlogEventCommands.CREATE,
    dto: CreateBlogEventDto,
    valid: {
      name: 'Launch Party',
      description: 'Launch day celebration',
      location: 'HQ Main Hall',
      startTime: new Date('2026-11-01T10:00:00.000Z'),
      endTime: new Date('2026-11-01T12:00:00.000Z'),
      organizerId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
    },
    invalid: {
      description: 'Launch day celebration',
      location: 'HQ Main Hall',
      startTime: new Date('2026-11-01T10:00:00.000Z'),
      endTime: new Date('2026-11-01T12:00:00.000Z'),
      organizerId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
    },
    invalidProps: ['name'],
  },
  {
    pattern: BlogPostCommands.CREATE,
    dto: CreateBlogPostDto,
    valid: {
      title: 'Hello World',
      content: 'A proper long body.',
      authorId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
    },
    invalid: {
      title: 'Hello World',
      authorId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
    },
    invalidProps: ['content'],
  },
  {
    pattern: BlogComponentCommands.CREATE,
    dto: CreateBlogComponentDto,
    valid: {
      blogPostId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
      instanceId: 'inst-1',
      componentType: 'callout',
      componentData: { text: 'Hi' },
      position: 0,
    },
    invalid: {
      instanceId: 'inst-1',
      componentType: 'callout',
      componentData: { text: 'Hi' },
      position: 0,
    },
    invalidProps: ['blogPostId'],
  },
];

/** Verified `{id}`/scope, `FindManyOptions`, or query-DTO sends — complete by definition. */
const SCALAR_OR_EMPTY: string[] = [
  BlogCommands.UPDATE,
  BlogCommands.DELETE,
  BlogCommands.FIND,
  BlogCommands.FIND_ALL,
  BlogCatalogCommands.FIND_ALL,
  ContactCommands.UPDATE,
  ContactCommands.DELETE,
  ContactCommands.FIND,
  ContactCommands.FIND_ALL,
  BlogEventCommands.UPDATE,
  BlogEventCommands.DELETE,
  BlogEventCommands.FIND,
  BlogEventCommands.FIND_ALL,
  BlogPostCommands.UPDATE,
  BlogPostCommands.DELETE,
  BlogPostCommands.FIND,
  BlogPostCommands.FIND_ALL,
  BlogPostCommands.FIND_DRAFTS_BY_AUTHOR,
  BlogPostCommands.FIND_PUBLISHED_SCOPED,
  BlogComponentCommands.UPDATE,
  BlogComponentCommands.DELETE,
  BlogComponentCommands.FIND,
  BlogComponentCommands.FIND_ALL,
  BlogComponentCommands.FIND_BY_POST,
  BlogComponentCommands.FIND_BY_QUERY,
  BlogComponentCommands.DELETE_BY_POST,
];

/** Follow-up slices, not this one. */
const DEFERRED: string[] = [
  BlogCommands.GENERATE_SITEMAP,
  BlogPostCommands.FIND_PUBLISHED,
  BlogPostCommands.PUBLISH,
  BlogPostCommands.GENERATE_RSS,
  BlogPostCommands.GENERATE_SEO,
  BlogPostCommands.SEARCH,
];

const COMMAND_OBJECTS: Record<string, Record<string, string>> = {
  BlogCommands,
  BlogCatalogCommands,
  ContactCommands,
  BlogEventCommands,
  BlogPostCommands,
  BlogComponentCommands,
};

const propsOf = (errors: ValidationError[]) =>
  errors.map((e) => e.property).sort();

describe('blogging-contract-parity', () => {
  it.each(COVERED.map((c) => [c.pattern, c]))(
    'pattern %s validates its DTO both ways',
    async (_pattern, entry) => {
      const valid = plainToInstance(entry.dto, entry.valid);
      expect(await validate(valid)).toEqual([]);
      const invalid = plainToInstance(entry.dto, entry.invalid);
      expect(propsOf(await validate(invalid))).toEqual(
        [...entry.invalidProps].sort()
      );
    }
  );

  it('accounts for every key in the blogging command objects', () => {
    const coveredValues = new Set(COVERED.map((c) => c.pattern));
    const allowed = new Set([...SCALAR_OR_EMPTY, ...DEFERRED]);
    for (const commands of Object.values(COMMAND_OBJECTS)) {
      for (const value of Object.values(commands)) {
        expect(coveredValues.has(value) || allowed.has(value)).toBe(true);
      }
    }
    for (const pattern of DEFERRED) {
      expect(coveredValues.has(pattern)).toBe(false);
    }
  });
});
