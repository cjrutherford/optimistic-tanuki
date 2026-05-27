import { TestBed } from '@angular/core/testing';
import { MaterialRichTextEditorComponent } from './material-rich-text-editor.component';

describe('MaterialRichTextEditorComponent', () => {
  it('renders a Tiptap editing surface with formatting controls', async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialRichTextEditorComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(MaterialRichTextEditorComponent);
    fixture.componentRef.setInput(
      'content',
      '<p>Hosted <strong>metering</strong></p>'
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Bold');
    expect(fixture.nativeElement.textContent).not.toContain('Underline');
    expect(
      fixture.nativeElement.querySelector('[data-testid="tiptap-editor"]')
    ).not.toBeNull();
  });
});
