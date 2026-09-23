import { OptomisitcTanukiAPIService } from './generated/blogging';

/**
 * Guards against tag-filter regressions silently dropping operations from
 * the generated client: all blogging routes must stay present.
 * NOTE: lives outside src/generated/ because orval `clean:true` wipes that
 * directory on every run.
 */
const METHODS = [
  'blogComponentControllerCreateBlogComponent',
  'blogComponentControllerDeleteBlogComponent',
  'blogComponentControllerDeleteComponentsByPost',
  'blogComponentControllerFindComponentsByQuery',
  'blogComponentControllerGetBlogComponent',
  'blogComponentControllerGetBlogComponents',
  'blogComponentControllerUpdateBlogComponent',
  'blogControllerCreateBlog',
  'blogControllerCreateCatalog',
  'blogControllerDeleteBlog',
  'blogControllerFindAllBlogs',
  'blogControllerFindCatalogPosts',
  'blogControllerFindMyCatalogs',
  'blogControllerFindPublishedPostsByDomain',
  'blogControllerGetBlog',
  'blogControllerGetSitemap',
  'blogControllerUpdateBlog',
  'contactControllerCreateContact',
  'contactControllerDeleteContact',
  'contactControllerFindAllContacts',
  'contactControllerFindAllLeads',
  'contactControllerGetContact',
  'contactControllerGetLead',
  'contactControllerRespondToLead',
  'contactControllerUpdateContact',
  'contactControllerUpdateLead',
  'eventControllerCreateEvent',
  'eventControllerDeleteEvent',
  'eventControllerFindAllEvents',
  'eventControllerGetEvent',
  'eventControllerUpdateEvent',
  'postControllerCreatePost',
  'postControllerDeletePost',
  'postControllerFindAllPosts',
  'postControllerGetDraftsByAuthor',
  'postControllerGetPost',
  'postControllerGetPostSeoMetadata',
  'postControllerGetPublishedPosts',
  'postControllerGetRssFeed',
  'postControllerPublishPost',
  'postControllerSearchPosts',
  'postControllerUpdatePost',
] as const;

describe('generated blogging client operations', () => {
  it('exposes all blogging operations', () => {
    expect(METHODS).toHaveLength(42);
    for (const method of METHODS) {
      expect(typeof OptomisitcTanukiAPIService.prototype[method]).toBe(
        'function'
      );
    }
  });
});
