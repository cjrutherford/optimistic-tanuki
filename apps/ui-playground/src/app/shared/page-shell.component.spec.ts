import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageShellComponent } from './page-shell.component';

describe('PageShellComponent', () => {
  let fixture: ComponentFixture<PageShellComponent>;
  let component: PageShellComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageShellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageShellComponent);
    component = fixture.componentInstance;
    component.packageName = '@optimistic-tanuki/common-ui';
    component.title = 'Common UI';
    component.description =
      'Shared components for common interface building blocks.';
    component.importSnippet =
      "import { ButtonComponent } from '@optimistic-tanuki/common-ui';";
    fixture.detectChanges();
  });

  it('uses plain-language shared labels for usage and preview sections', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Component index');
    expect(root.textContent).toContain('Usage');
    expect(root.textContent).toContain('Component previews');
    expect(root.textContent).not.toContain('Import Surface');
  });
});
