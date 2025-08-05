import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AttachmentComponent } from './attachment.component';

describe('AttachmentComponent', () => {
  let component: AttachmentComponent;
  let fixture: ComponentFixture<AttachmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttachmentComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AttachmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add an attachment and emit changes', () => {
    const testFile = new File([''], 'test.txt', { type: 'text/plain' });
    jest.spyOn(component.attachmentsChange, 'emit');
    component.addAttachment(testFile);
    expect(component.attachments).toContain(testFile);
    expect(component.attachmentsChange.emit).toHaveBeenCalledWith({
      all: [testFile],
      added: [testFile],
      removed: [],
    });
  });

  it('should remove an attachment and emit changes', () => {
    const testFile = new File([''], 'test.txt', { type: 'text/plain' });
    component.attachments = [testFile];
    jest.spyOn(component.attachmentsChange, 'emit');
    component.removeAttachment(testFile);
    expect(component.attachments).not.toContain(testFile);
    expect(component.attachmentsChange.emit).toHaveBeenCalledWith({
      all: [],
      added: [],
      removed: [testFile],
    });
  });

  it('should not remove an attachment if it does not exist', () => {
    const testFile = new File([''], 'test.txt', { type: 'text/plain' });
    const nonExistentFile = new File([''], 'nonexistent.txt', { type: 'text/plain' });
    component.attachments = [testFile];
    jest.spyOn(component.attachmentsChange, 'emit');
    component.removeAttachment(nonExistentFile);
    expect(component.attachments).toContain(testFile);
    expect(component.attachmentsChange.emit).not.toHaveBeenCalled();
  });
});