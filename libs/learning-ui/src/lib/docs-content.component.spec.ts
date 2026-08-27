import { TestBed } from '@angular/core/testing';
import { DocsContentComponent } from './docs-content.component';

describe('DocsContentComponent', () => {
  async function render() {
    TestBed.configureTestingModule({ imports: [DocsContentComponent] });
    const fixture = TestBed.createComponent(DocsContentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('has a section for learners and a section for authors', async () => {
    const element = await render();

    expect(element.querySelector('#learners')).not.toBeNull();
    expect(element.querySelector('#authors')).not.toBeNull();
  });

  it('offers jump links to both sections', async () => {
    const element = await render();
    const hrefs = Array.from(element.querySelectorAll('.jump a')).map((a) =>
      a.getAttribute('href')
    );

    expect(hrefs).toEqual(['#learners', '#authors']);
  });

  it('explains that reading needs no account but submitting needs enrolment', async () => {
    const element = await render();
    const learners = element.querySelector('#learners')?.textContent ?? '';

    expect(learners).toContain('Submitting work does');
  });

  it('explains that points are only added once per exercise', async () => {
    const element = await render();
    const learners = element.querySelector('#learners')?.textContent ?? '';

    expect(learners).toContain('not add its points a second time');
  });

  it('is honest that offline does not cover submitting work', async () => {
    const element = await render();
    const learners = element.querySelector('#learners')?.textContent ?? '';

    expect(learners).toContain(
      'does not accept submitted work while you are offline'
    );
  });

  it('explains that only the owner may publish or unpublish', async () => {
    const element = await render();
    const authors = element.querySelector('#authors')?.textContent ?? '';

    expect(authors).toContain('owner’s call alone');
  });

  it('explains the evidence check to authors writing a rubric', async () => {
    const element = await render();
    const authors = element.querySelector('#authors')?.textContent ?? '';

    expect(authors).toContain('quote the exact words');
  });

  it('warns against criteria that cannot be quoted against', async () => {
    const element = await render();
    const authors = element.querySelector('#authors')?.textContent ?? '';

    expect(authors).toContain('cannot');
  });
});
