import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { CourseEditorComponent } from './course-editor.component';

describe('CourseEditorComponent', () => {
  const detail = (overrides: Record<string, unknown> = {}) => ({
    offering: {
      id: 'art-1',
      displayName: 'Intro to Watercolour',
      description: 'Three pigments.',
      subjectId: 'art',
      level: 100,
      credits: 1,
      status: 'draft',
      modules: [
        {
          id: 'm1',
          title: 'Pigments',
          lessons: [
            {
              id: 'l1',
              title: 'Three pigments',
              slug: 'three-pigments',
              content: [{ format: 'markdown', body: '# Three pigments' }],
            },
          ],
        },
      ],
      activities: [],
      ...(overrides['offering'] as object),
    },
    trackId: 'art-1',
    trackDisplayName: 'Intro to Watercolour',
    lessonCount: 1,
    prerequisites: [],
    author: null,
    isEnrolled: false,
    // Owned unless a test says otherwise. Only the owner may publish.
    isOwner: 'isOwner' in overrides ? (overrides['isOwner'] as boolean) : true,
  });

  async function render(response: unknown = detail()) {
    TestBed.configureTestingModule({
      imports: [CourseEditorComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ offeringId: 'art-1' }) },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CourseEditorComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/learning/offerings/art-1').flush(response);
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush([]);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      element: fixture.nativeElement as HTMLElement,
      http,
      button: (label: string) =>
        Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button')
        ).find(
          (candidate) =>
            candidate.getAttribute('aria-label') === label ||
            candidate.textContent?.trim() === label
        ),
    };
  }

  it('loads the course as it stands', async () => {
    const { element } = await render();

    expect((element.querySelector('.name') as HTMLInputElement).value).toBe(
      'Intro to Watercolour'
    );
    expect(element.textContent).toContain('Three pigments');
  });

  it('says whether the course is published', async () => {
    const { element } = await render();

    expect(element.querySelector('.eyebrow')?.textContent?.trim()).toBe(
      'Draft'
    );
  });

  it('asks the author to pick a lesson before writing one', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('Pick a lesson from the outline');
  });

  it('opens a lesson for writing when it is picked', async () => {
    const { fixture, element } = await render();

    fixture.componentInstance.selected.set({ moduleIndex: 0, lessonIndex: 0 });
    fixture.detectChanges();

    // The first textarea on the page is the course description, so this
    // has to be the lesson editor's own.
    const textarea = element.querySelector(
      'otlearn-lesson-editor textarea'
    ) as HTMLTextAreaElement;
    expect(textarea.value).toContain('# Three pigments');
  });

  /**
   * The preview has to come from the reader's pipeline, or a writer is
   * checking their words against a renderer nobody else uses. That pipeline
   * demotes headings by one, because the page supplies the lesson's own h1,
   * so a preview showing an h1 here would mean the two had diverged.
   */
  it('previews with the same markdown pipeline a reader gets', async () => {
    const { fixture } = await render();

    fixture.componentInstance.selected.set({ moduleIndex: 0, lessonIndex: 0 });
    fixture.detectChanges();

    expect(fixture.componentInstance.preview()).toBe('<h2>Three pigments</h2>');
  });

  it('shows the writer a rendered preview, not their raw markdown', async () => {
    const { fixture, element } = await render();

    fixture.componentInstance.selected.set({ moduleIndex: 0, lessonIndex: 0 });
    fixture.detectChanges();

    expect(element.querySelector('otlearn-lesson-prose')?.innerHTML).toContain(
      '<h2>Three pigments</h2>'
    );
  });

  it('keeps what is typed into a lesson', async () => {
    const { fixture } = await render();
    fixture.componentInstance.selected.set({ moduleIndex: 0, lessonIndex: 0 });
    fixture.detectChanges();

    fixture.componentInstance['editLesson']('body', 'Start with a warm red.');

    expect(fixture.componentInstance.modules()[0].lessons[0].body).toBe(
      'Start with a warm red.'
    );
  });

  it('saves the whole course in one request', async () => {
    const { fixture, http, button } = await render();

    button('Save')?.click();
    const request = http.expectOne('/api/learning/offerings/art-1');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body.displayName).toBe('Intro to Watercolour');
    expect(request.request.body.modules[0].lessons[0].content).toEqual([
      { format: 'markdown', body: '# Three pigments' },
    ]);
    request.flush({});
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Saved.'
    );
  });

  // The server validates the whole course, so a refusal usually means
  // something is half-written rather than that anything broke.
  it('explains a refused save in terms of what is unfinished', async () => {
    const { fixture, element, http, button } = await render();

    button('Save')?.click();
    http
      .expectOne('/api/learning/offerings/art-1')
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(element.textContent).toContain('every lesson has words in it');
  });

  it("says plainly when a course is not the caller's to change", async () => {
    const { fixture, element, http, button } = await render();

    button('Save')?.click();
    http
      .expectOne('/api/learning/offerings/art-1')
      .flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(element.textContent).toContain('not yours to change');
  });

  it('publishes through the route that is authorized separately', async () => {
    const { fixture, element, http, button } = await render();

    button('Publish')?.click();
    const request = http.expectOne('/api/learning/offerings/art-1/status');

    expect(request.request.body).toEqual({ status: 'published' });
    request.flush({});
    fixture.detectChanges();

    expect(element.textContent).toContain('Published.');
    expect(element.querySelector('.eyebrow')?.textContent?.trim()).toBe(
      'Published'
    );
  });

  it('takes a published course back down', async () => {
    const published = detail({ offering: { status: 'published' } });
    const { http, button } = await render(published);

    button('Unpublish')?.click();

    expect(
      http.expectOne('/api/learning/offerings/art-1/status').request.body
    ).toEqual({ status: 'draft' });
  });

  it('offers every kind of activity, not only running code', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('Add Written response');
    expect(element.textContent).toContain('Add Multiple choice');
    expect(element.textContent).toContain('Add Project submission');
  });

  it('opens an empty course without falling over', async () => {
    const empty = detail({ offering: { modules: [], activities: [] } });
    const { element } = await render(empty);

    expect(element.textContent).toContain('No modules yet');
  });

  /**
   * Publishing is the owner's decision, and the server enforces that. The
   * button was shown to everyone regardless, so a co-editor got a control
   * that always answered 403.
   */
  describe('who may publish', () => {
    function publishButton(element: HTMLElement) {
      return Array.from(element.querySelectorAll('button')).find((candidate) =>
        /publish/i.test(candidate.textContent || '')
      );
    }

    it('offers publishing to the owner', async () => {
      const { element } = await render(detail({ isOwner: true }));

      expect(publishButton(element)).toBeDefined();
    });

    it('hides it from a co-editor', async () => {
      const { element } = await render(detail({ isOwner: false }));

      expect(publishButton(element)).toBeUndefined();
    });

    // A course whose ownership the server declined to state is not one this
    // viewer may publish.
    it('hides it when the server says nothing about ownership', async () => {
      const { element } = await render(detail({ isOwner: undefined }));

      expect(publishButton(element)).toBeUndefined();
    });

    it('still lets a co-editor save their edits', async () => {
      const { element } = await render(detail({ isOwner: false }));

      expect(
        Array.from(element.querySelectorAll('button')).find(
          (candidate) => candidate.textContent?.trim() === 'Save'
        )
      ).toBeDefined();
    });
  });
});
