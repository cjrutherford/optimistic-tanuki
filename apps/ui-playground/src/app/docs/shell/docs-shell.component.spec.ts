import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocsShellComponent } from './docs-shell.component';

describe('DocsShellComponent', () => {
  let fixture: ComponentFixture<DocsShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocsShellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DocsShellComponent);
    fixture.componentInstance.title = 'Operational Documentation';
    fixture.componentInstance.description = 'Read repo guides and runbooks.';
    fixture.detectChanges();
  });

  it('uses a clearer docs hero label', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Documentation');
    expect(root.textContent).not.toContain('Repository Atlas');
  });
});
