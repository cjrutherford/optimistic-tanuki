import { TestBed } from '@angular/core/testing';
import { AboutContentComponent } from './about-content.component';

describe('AboutContentComponent', () => {
  async function render() {
    TestBed.configureTestingModule({ imports: [AboutContentComponent] });
    const fixture = TestBed.createComponent(AboutContentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('says what the platform is', async () => {
    const element = await render();

    expect(element.textContent).toContain('argument');
  });

  it('explains that marking has to cite the learner’s own words', async () => {
    const element = await render();

    expect(element.textContent).toContain('quotation');
  });

  it('names the seven courses honestly rather than a round number', async () => {
    const element = await render();

    expect(element.textContent).toContain('Seven courses');
    expect(element.textContent).toContain('TypeScript');
    expect(element.textContent).toContain('Tech Literacy');
  });

  // The whole point of this page is that it says what does not work yet.
  it('has an honest limitations section', async () => {
    const element = await render();

    expect(element.textContent).toContain('does not do yet');
  });

  it('is honest that only the owner may publish', async () => {
    const element = await render();

    expect(element.textContent).toContain('owner’s decision alone');
  });
});
