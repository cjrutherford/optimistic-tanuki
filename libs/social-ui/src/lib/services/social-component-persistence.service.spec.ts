import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL, SocialComponentDto } from '@optimistic-tanuki/ui-models';
import {
  ComponentExtractionResult,
  SocialComponentPersistenceService,
} from './social-component-persistence.service';

const BASE = 'http://localhost:3000';
const GATEWAY = `${BASE}/social-components`;

describe('SocialComponentPersistenceService', () => {
  let service: SocialComponentPersistenceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SocialComponentPersistenceService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });

    service = TestBed.inject(SocialComponentPersistenceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('extractComponentsFromContent', () => {
    it('extracts each fully-attributed component node with its document order', () => {
      const content = `
        <p>intro</p>
        <div data-angular-component data-component-id="callout-box" data-instance-id="a1" data-component-data='{"title":"One"}'></div>
        <div data-angular-component data-component-id="code-snippet" data-instance-id="b2" data-component-data='{"code":"x"}'></div>
      `;

      const result = service.extractComponentsFromContent(content);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        instanceId: 'a1',
        componentType: 'callout-box',
        componentData: { title: 'One' },
        position: 0,
      });
      expect(result[1]).toMatchObject({
        instanceId: 'b2',
        componentType: 'code-snippet',
        componentData: { code: 'x' },
        position: 1,
      });
      expect(result[0].domNode.getAttribute('data-instance-id')).toBe('a1');
    });

    it('skips nodes with unparsable component data', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation();
      const content = `<div data-angular-component data-component-id="callout-box" data-instance-id="a1" data-component-data="{not json}"></div>`;

      expect(service.extractComponentsFromContent(content)).toEqual([]);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('skips nodes missing required attributes', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation();
      const content = `<div data-angular-component data-instance-id="a1"></div>`;

      expect(service.extractComponentsFromContent(content)).toEqual([]);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('returns an empty list when the content has no component nodes', () => {
      expect(service.extractComponentsFromContent('<p>plain</p>')).toEqual([]);
    });
  });

  describe('saveComponents', () => {
    const component: ComponentExtractionResult = {
      instanceId: 'a1',
      componentType: 'callout-box',
      componentData: { title: 'One' },
      position: 0,
      domNode: document.createElement('div'),
    };

    it('posts one create request per component and joins the responses', (done) => {
      const second: ComponentExtractionResult = {
        ...component,
        instanceId: 'b2',
        componentType: 'code-snippet',
        position: 1,
      };

      service.saveComponents('post-1', [component, second]).subscribe((res) => {
        expect(res.map((r) => r.id)).toEqual(['saved-1', 'saved-2']);
        done();
      });

      const requests = http.match(GATEWAY);
      expect(requests).toHaveLength(2);
      expect(requests[0].request.method).toBe('POST');
      expect(requests[0].request.body).toEqual({
        postId: 'post-1',
        instanceId: 'a1',
        componentType: 'callout-box',
        componentData: { title: 'One' },
        position: 0,
      });
      expect(requests[1].request.body).toMatchObject({
        instanceId: 'b2',
        position: 1,
      });

      requests[0].flush({ id: 'saved-1' } as SocialComponentDto);
      requests[1].flush({ id: 'saved-2' } as SocialComponentDto);
    });

    it('emits an empty array without issuing requests when there is nothing to save', (done) => {
      service.saveComponents('post-1', []).subscribe((res) => {
        expect(res).toEqual([]);
        done();
      });

      http.expectNone(GATEWAY);
    });
  });

  it('fetches the stored components for a post', (done) => {
    const stored = [{ id: 'c1' }] as SocialComponentDto[];

    service.getComponentsForPost('post-1').subscribe((res) => {
      expect(res).toBe(stored);
      done();
    });

    const req = http.expectOne(`${GATEWAY}/post/post-1`);
    expect(req.request.method).toBe('GET');
    req.flush(stored);
  });

  describe('updateComponent', () => {
    it('sends only componentData when no position is supplied', (done) => {
      service.updateComponent('c1', { title: 'New' }).subscribe(() => done());

      const req = http.expectOne(`${GATEWAY}/c1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ componentData: { title: 'New' } });
      req.flush({ id: 'c1' } as SocialComponentDto);
    });

    it('includes the position when one is supplied', (done) => {
      service
        .updateComponent('c1', { title: 'New' }, 4)
        .subscribe(() => done());

      const req = http.expectOne(`${GATEWAY}/c1`);
      expect(req.request.body).toEqual({
        componentData: { title: 'New' },
        position: 4,
      });
      req.flush({ id: 'c1' } as SocialComponentDto);
    });

    it('includes a zero position rather than dropping it', () => {
      service.updateComponent('c1', {}, 0).subscribe();

      const req = http.expectOne(`${GATEWAY}/c1`);
      expect(req.request.body).toEqual({ componentData: {}, position: 0 });
      req.flush({ id: 'c1' } as SocialComponentDto);
    });
  });

  it('deletes a single component', (done) => {
    service.deleteComponent('c1').subscribe(() => done());

    const req = http.expectOne(`${GATEWAY}/c1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('deletes every component belonging to a post', (done) => {
    service.deleteComponentsByPost('post-1').subscribe(() => done());

    const req = http.expectOne(`${GATEWAY}/post/post-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  describe('cleanContentForStorage', () => {
    it('drops data-component-data but keeps the reconstruction attributes', () => {
      const content = `<div data-angular-component data-component-id="callout-box" data-instance-id="a1" data-component-data='{"title":"One"}'>x</div>`;

      const cleaned = service.cleanContentForStorage(content);

      expect(cleaned).not.toContain('data-component-data');
      expect(cleaned).toContain('data-component-id="callout-box"');
      expect(cleaned).toContain('data-instance-id="a1"');
    });

    it('leaves content without component nodes structurally intact', () => {
      expect(service.cleanContentForStorage('<p>hello</p>')).toContain(
        '<p>hello</p>'
      );
    });
  });
});
