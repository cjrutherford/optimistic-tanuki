import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComposeComponent, ComposeCompleteEvent } from './compose.component';
import { QuillEditorComponent } from 'ngx-quill';
import Quill from 'quill';
import { AttachmentDto, CreateAttachmentDto, CreatePostDto } from '../../models';
import { LinkType } from '../link/link.component';

describe('ComposeComponent', () => {
  let component: ComposeComponent;
  let fixture: ComponentFixture<ComposeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComposeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ComposeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Mock quillEditor and quillEditor.quillEditor
    component.quillEditor = { 
      quillEditor: { 
        insertEmbed: jest.fn(),
        getSelection: () => ({ index: 0 }),
        clipboard: { dangerouslyPasteHTML: jest.fn() }
      } as unknown as Quill
    } as QuillEditorComponent;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set isDragOver to true on onDragOver', () => {
    const event = { preventDefault: () => {} } as DragEvent;
    jest.spyOn(event, 'preventDefault');
    component.onDragOver(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.isDragOver).toBe(true);
  });

  it('should set isDragOver to false on onDragLeave', () => {
    const event = { preventDefault: () => {} } as DragEvent;
    jest.spyOn(event, 'preventDefault');
    component.onDragLeave(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.isDragOver).toBe(false);
  });

  it('should handle image drop correctly', () => {
    const mockFile = new File([''], 'image.png', { type: 'image/png' });
    const mockFileList = { 
      0: mockFile, 
      length: 1, 
      item: (index: number) => mockFile 
    } as unknown as FileList;
    const mockDataTransfer = { files: mockFileList } as DataTransfer;
    const event = { 
      preventDefault: () => {}, 
      dataTransfer: mockDataTransfer 
    } as DragEvent;
    
    jest.spyOn(event, 'preventDefault');
    const insertEmbedSpy = jest.spyOn(component.quillEditor.quillEditor, 'insertEmbed');

    // Mock FileReader
    const mockFileReader = {
      readAsDataURL: jest.fn(),
      onload: jest.fn(),
    };
    jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as unknown as FileReader);

    component.onDrop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.isDragOver).toBe(false);
    expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(mockFile);

    // Simulate onload event
    mockFileReader.onload({ target: { result: 'data:image/png;base64,test' } } as unknown as ProgressEvent<FileReader>);
    expect(insertEmbedSpy).toHaveBeenCalledWith(0, 'image', 'data:image/png;base64,test');
  });

  it('should handle video drop correctly', () => {
    const mockFile = new File([''], 'video.mp4', { type: 'video/mp4' });
    const mockFileList = { 
      0: mockFile, 
      length: 1, 
      item: (index: number) => mockFile 
    } as unknown as FileList;
    const mockDataTransfer = { files: mockFileList } as DataTransfer;
    const event = { 
      preventDefault: () => {}, 
      dataTransfer: mockDataTransfer 
    } as DragEvent;
    
    jest.spyOn(event, 'preventDefault');
    const insertEmbedSpy = jest.spyOn(component.quillEditor.quillEditor, 'insertEmbed');

    // Mock FileReader
    const mockFileReader = {
      readAsDataURL: jest.fn(),
      onload: jest.fn(),
    };
    jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as unknown as FileReader);

    component.onDrop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.isDragOver).toBe(false);
    expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(mockFile);

    // Simulate onload event
    mockFileReader.onload({ target: { result: 'data:video/mp4;base64,test' } } as unknown as ProgressEvent<FileReader>);
    expect(insertEmbedSpy).toHaveBeenCalledWith(0, 'video', 'data:video/mp4;base64,test');
  });

  it('should handle other file drop correctly', () => {
    const mockFile = new File([''], 'document.pdf', { type: 'application/pdf' });
    const mockFileList = { 
      0: mockFile, 
      length: 1, 
      item: (index: number) => mockFile 
    } as unknown as FileList;
    const mockDataTransfer = { files: mockFileList } as DataTransfer;
    const event = { 
      preventDefault: () => {}, 
      dataTransfer: mockDataTransfer 
    } as DragEvent;
    
    jest.spyOn(event, 'preventDefault');
    const dangerouslyPasteHTMLSpy = jest.spyOn(component.quillEditor.quillEditor.clipboard, 'dangerouslyPasteHTML');

    // Mock FileReader
    const mockFileReader = {
      readAsDataURL: jest.fn(),
      onload: jest.fn(),
    };
    jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as unknown as FileReader);

    component.onDrop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.isDragOver).toBe(false);
    expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(mockFile);

    // Simulate onload event
    mockFileReader.onload({ target: { result: 'data:application/pdf;base64,test' } } as unknown as ProgressEvent<FileReader>);
    expect(dangerouslyPasteHTMLSpy).toHaveBeenCalledWith(0, '<a href="data:application/pdf;base64,test" target="_blank">document.pdf</a>');
  });

  it('should not process drop if no files', () => {
    const mockDataTransfer = { files: null } as unknown as DataTransfer;
    const event = { 
      preventDefault: () => {}, 
      dataTransfer: mockDataTransfer 
    } as DragEvent;
    
    jest.spyOn(event, 'preventDefault');
    const insertEmbedSpy = jest.spyOn(component.quillEditor.quillEditor, 'insertEmbed');
    const dangerouslyPasteHTMLSpy = jest.spyOn(component.quillEditor.quillEditor.clipboard, 'dangerouslyPasteHTML');

    component.onDrop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.isDragOver).toBe(false);
    expect(insertEmbedSpy).not.toHaveBeenCalled();
    expect(dangerouslyPasteHTMLSpy).not.toHaveBeenCalled();
  });

  it('should parse images correctly', () => {
    const doc = new DOMParser().parseFromString('<div><img src="image1.jpg"><img src="image2.png"></div>', 'text/html');
    const attachments = component.parseImages(doc);
    expect(attachments).toEqual([
      { url: 'image1.jpg', postId: '' },
      { url: 'image2.png', postId: '' },
    ]);
  });

  it('should parse videos correctly', () => {
    const doc = new DOMParser().parseFromString('<div><video src="video1.mp4"></video><video src="video2.mov"></video></div>', 'text/html');
    const attachments = component.parseVideos(doc);
    expect(attachments).toEqual([
      { url: 'video1.mp4', postId: '' },
      { url: 'video2.mov', postId: '' },
    ]);
  });

  it('should parse other attachments correctly', () => {
    const doc = new DOMParser().parseFromString('<div><a data-attachment="file1.pdf"></a><span data-attachment="file2.doc"></span></div>', 'text/html');
    const attachments = component.parseAttachments(doc);
    expect(attachments).toEqual([
      { url: 'file1.pdf', postId: '' },
      { url: 'file2.doc', postId: '' },
    ]);
  });

  it('should submit post and reset form', () => {
    jest.spyOn(component.postSubmitted, 'emit');
    component.title = 'Test Title';
    component.content = 'Test Content';
    component.attachments = [{ url: 'attach1.jpg', postId: '' }] as AttachmentDto[];
    component.links = [{ url: 'link1.com', title: 'Link 1' }] as LinkType[];

    component.onSubmit();

    expect(component.postSubmitted.emit).toHaveBeenCalledWith({
      post: { title: 'Test Title', content: 'Test Content', attachments: [], profileId: '' } as CreatePostDto,
      attachments: [{ url: 'attach1.jpg', postId: '' }] as CreateAttachmentDto[],
      links: [{ url: 'link1.com' }] as { url: string }[],
    } as ComposeCompleteEvent);
    expect(component.title).toBe('');
    expect(component.content).toBe('');
    expect(component.attachments).toEqual([]);
    expect(component.links).toEqual([]);
  });

  it('should update content on onContentChange', () => {
    const event = { html: '<p>New content</p><img src="new-image.jpg">' };
    jest.spyOn(console, 'log');
    component.onContentChange(event);
    expect(component.content).toBe(event.html);
    expect(console.log).toHaveBeenCalledWith('Content changed:', event);
    expect(console.log).toHaveBeenCalledWith('Content changed:', event.html);
  });

  it('should call onSubmit on onPostSubmit', () => {
    jest.spyOn(component, 'onSubmit');
    component.onPostSubmit();
    expect(component.onSubmit).toHaveBeenCalled();
  });
});