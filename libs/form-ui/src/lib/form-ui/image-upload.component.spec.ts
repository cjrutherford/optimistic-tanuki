import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageUploadComponent } from './image-upload.component';

describe('ImageUploadComponent', () => {
  let component: ImageUploadComponent;
  let fixture: ComponentFixture<ImageUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageUploadComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set currentImage on ngOnInit if provided', () => {
    const imageUrl = 'data:image/png;base64,testimage';
    component.currentImage = imageUrl;
    component.ngOnInit();
    expect(component.image).toBe(imageUrl);
  });

  it('should handle image change', () => {
    const mockFile = new File([''], 'test.png', { type: 'image/png' });
    const mockEvt = { target: { files: [mockFile] } } as unknown as Event;
    const readFileSpy = jest.spyOn(component as any, 'readFile');
    component.handleImageChange(mockEvt);
    expect(readFileSpy).toHaveBeenCalledWith(mockFile);
  });

  it('should handle drop event', () => {
    const mockFile = new File([''], 'test.png', { type: 'image/png' });
    const mockEvt = {
      preventDefault: () => {},
      dataTransfer: { files: [mockFile] },
    } as unknown as DragEvent;
    const readFileSpy = jest.spyOn(component as any, 'readFile');
    component.handleDrop(mockEvt);
    expect(component.isDragOver).toBe(false);
    expect(readFileSpy).toHaveBeenCalledWith(mockFile);
  });

  it('should handle dragover event', () => {
    const mockEvt = { preventDefault: () => {} } as DragEvent;
    component.handleDragOver(mockEvt);
    expect(component.isDragOver).toBe(true);
  });

  it('should handle dragleave event', () => {
    const mockEvt = { preventDefault: () => {} } as DragEvent;
    component.handleDragLeave(mockEvt);
    expect(component.isDragOver).toBe(false);
  });

  it('should read file and emit imageUpload event', (done) => {
    const mockFile = new File(['test content'], 'test.png', { type: 'image/png' });
    const emitSpy = jest.spyOn(component.imageUpload, 'emit');

    // Mock FileReader
    const mockFileReader = {
      result: 'data:image/png;base64,dGVzdCBjb250ZW50', // Base64 of 'test content'
      onloadend: jest.fn(),
      readAsDataURL: jest.fn(),
    };
    jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

    // Call the private method
    (component as any).readFile(mockFile);

    // Simulate onloadend event
    mockFileReader.onloadend();

    expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(mockFile);
    expect(component.image).toBe(mockFileReader.result);
    expect(emitSpy).toHaveBeenCalledWith(mockFileReader.result);
    done();
  });
});
