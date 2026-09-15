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
    const labels = Array.from(element.querySelectorAll('.jump button')).map(
      (button) => button.textContent?.trim()
    );

    expect(labels).toEqual(['For learners', 'For authors']);
    expect(
      element.querySelector('.jump button[aria-pressed="true"]')?.textContent
    ).toContain('For learners');
  });

  it('marks the selected section when a jump button is activated', async () => {
    TestBed.configureTestingModule({ imports: [DocsContentComponent] });
    const fixture = TestBed.createComponent(DocsContentComponent);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector(
        '.jump button:nth-of-type(2)'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.jump button[aria-pressed="true"]')
        ?.textContent
    ).toContain('For authors');
  });

  it('keeps the section navigation keyboard accessible', async () => {
    const element = await render();

    expect(
      Array.from(element.querySelectorAll('.jump button')).every(
        (button) => button.getAttribute('type') === 'button'
      )
    ).toBe(true);
    expect(element.querySelector('.jump button:focus-visible')).toBeNull();
  });

  it('explains that reading needs no account but submitting needs enrolment', async () => {
    const element = await render();
    const learners = element.querySelector('#learners')?.textContent ?? '';

    expect(learners).toContain('Submitting work does');
  });

  it('documents all four supported activity types', async () => {
    const element = await render();
    const learners = element.querySelector('#learners')?.textContent ?? '';

    expect(learners).toContain('Multiple choice');
    expect(learners).toContain('Written response');
    expect(learners).toContain('Project submission');
    expect(learners).toContain('Code run');
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
