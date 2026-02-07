import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentPersistenceService, ComponentExtractionResult } from './component-persistence.service';
import { BlogComponentDto, CreateBlogComponentDto } from '@optimistic-tanuki/ui-models';

describe('ComponentPersistenceService', () => {
  let service: ComponentPersistenceService;
  let httpMock: HttpTestingController;

  const mockComponent: BlogComponentDto = {
    id: 'component-1',
    blogPostId: 'post-1',
    instanceId: 'instance-1',
    componentType: 'author-profile',
    componentData: { name: 'John Doe', bio: 'Test bio' },
    position: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ComponentPersistenceService]
    });
    service = TestBed.inject(ComponentPersistenceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('extractComponentsFromContent', () => {
    it('should extract component data from HTML', () => {
      const html = `
        <div>
          <div 
            data-angular-component="true"
            data-component-id="author-profile"
            data-instance-id="instance-1"
            data-component-data='{"name":"John Doe","bio":"Test bio"}'
          ></div>
          <div 
            data-angular-component="true"
            data-component-id="featured-posts"
            data-instance-id="instance-2"
            data-component-data='{"count":5}'
          ></div>
        </div>
      `;

      const result = service.extractComponentsFromContent(html);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        instanceId: 'instance-1',
        componentType: 'author-profile',
        componentData: { name: 'John Doe', bio: 'Test bio' },
        position: 0,
        domNode: expect.any(HTMLElement)
      });
      expect(result[1]).toEqual({
        instanceId: 'instance-2',
        componentType: 'featured-posts',
        componentData: { count: 5 },
        position: 1,
        domNode: expect.any(HTMLElement)
      });
    });

    it('should handle invalid JSON in component data', () => {
      const html = `
        <div 
          data-angular-component="true"
          data-component-id="author-profile"
          data-instance-id="instance-1"
          data-component-data='invalid-json'
        ></div>
      `;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = service.extractComponentsFromContent(html);

      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse component data for instance:',
        'instance-1',
        expect.any(Error)
      );
    });

    it('should handle missing attributes', () => {
      const html = `
        <div 
          data-angular-component="true"
          data-component-id="author-profile"
        ></div>
      `;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = service.extractComponentsFromContent(html);

      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Component missing required attributes:',
        {
          componentId: 'author-profile',
          instanceId: null,
          hasData: false
        }
      );
    });
  });

  describe('saveComponents', () => {
    it('should save components to the database', () => {
      const components: ComponentExtractionResult[] = [
        {
          instanceId: 'instance-1',
          componentType: 'author-profile',
          componentData: { name: 'John Doe', bio: 'Test bio' },
          position: 0,
          domNode: document.createElement('div')
        }
      ];

      service.saveComponents('post-1', components).subscribe(result => {
        expect(result).toEqual([mockComponent]);
      });

      const req = httpMock.expectOne('/api/blog-components');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        blogPostId: 'post-1',
        instanceId: 'instance-1',
        componentType: 'author-profile',
        componentData: { name: 'John Doe', bio: 'Test bio' },
        position: 0
      });
      req.flush(mockComponent);
    });

    it('should return empty array for no components', () => {
      service.saveComponents('post-1', []).subscribe(result => {
        expect(result).toEqual([]);
      });

      httpMock.expectNone('/api/blog-components');
    });
  });

  describe('getComponentsForPost', () => {
    it('should get components for a post', () => {
      service.getComponentsForPost('post-1').subscribe(result => {
        expect(result).toEqual([mockComponent]);
      });

      const req = httpMock.expectOne('/api/blog-components/post/post-1');
      expect(req.request.method).toBe('GET');
      req.flush([mockComponent]);
    });
  });

  describe('updateComponent', () => {
    it('should update a component', () => {
      const newData = { name: 'Jane Doe', bio: 'Updated bio' };
      const updatedComponent = { ...mockComponent, componentData: newData };

      service.updateComponent('component-1', newData, 1).subscribe(result => {
        expect(result).toEqual(updatedComponent);
      });

      const req = httpMock.expectOne('/api/blog-components/component-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        componentData: newData,
        position: 1
      });
      req.flush(updatedComponent);
    });
  });

  describe('deleteComponent', () => {
    it('should delete a component', () => {
      service.deleteComponent('component-1').subscribe();

      const req = httpMock.expectOne('/api/blog-components/component-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('deleteComponentsByPost', () => {
    it('should delete all components for a post', () => {
      service.deleteComponentsByPost('post-1').subscribe();

      const req = httpMock.expectOne('/api/blog-components/post/post-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('cleanContentForStorage', () => {
    it('should remove component data attributes but keep structure', () => {
      const html = `
        <html><body>
          <div 
            data-angular-component="true"
            data-component-id="author-profile"
            data-instance-id="instance-1"
            data-component-data='{"name":"John Doe"}'
          ></div>
        </body></html>
      `;

      const result = service.cleanContentForStorage(html);

      expect(result).toContain('data-component-id="author-profile"');
      expect(result).toContain('data-instance-id="instance-1"');
      expect(result).not.toContain('data-component-data');
    });
  });
});