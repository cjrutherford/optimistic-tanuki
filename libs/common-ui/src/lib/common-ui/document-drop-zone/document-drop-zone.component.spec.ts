import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentDropZoneComponent } from './document-drop-zone.component';

describe('DocumentDropZoneComponent', () => {
  let component: DocumentDropZoneComponent;
  let fixture: ComponentFixture<DocumentDropZoneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentDropZoneComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentDropZoneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates component and renders default label', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.drop-zone-title');
    expect(heading.textContent).toContain(
      'Upload confidential client document'
    );
  });

  it('updates drag-over state on drag events', () => {
    const mockEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as DragEvent;

    component.onDragOver(mockEvent);
    expect(component.isDragOver).toBe(true);

    component.onDragLeave(mockEvent);
    expect(component.isDragOver).toBe(false);
  });

  it('emits fileSelected when file is dropped', (done) => {
    const file = new File(['confidential content'], 'IRS-1040.pdf', {
      type: 'application/pdf',
    });
    component.fileSelected.subscribe((emitted) => {
      expect(emitted.name).toBe('IRS-1040.pdf');
      done();
    });

    const dropEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
      dataTransfer: { files: [file] },
    } as unknown as DragEvent;

    component.onDrop(dropEvent);
  });
});
