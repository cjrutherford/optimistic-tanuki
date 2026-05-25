import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { CodeEditorComponent } from './code-editor.component';

describe('CodeEditorComponent', () => {
  let fixture: ComponentFixture<CodeEditorComponent>;
  let component: CodeEditorComponent;

  beforeEach(async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });

    await TestBed.configureTestingModule({
      imports: [CodeEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CodeEditorComponent);
    component = fixture.componentInstance;
    component.code = '<button>Copy</button>';
    fixture.detectChanges();
  });

  it('announces copy status through a polite live region', fakeAsync(() => {
    const root = fixture.nativeElement as HTMLElement;
    const copyButton = root.querySelector('.copy-btn') as HTMLButtonElement;

    copyButton.click();
    tick();
    fixture.detectChanges();

    const liveRegion = root.querySelector('[aria-live="polite"]');

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(component.code);
    expect(liveRegion?.textContent).toContain('Copied');
  }));
});
