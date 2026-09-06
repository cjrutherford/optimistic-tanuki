import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalloutBoxComponent } from './callout-box.component';
import { CodeSnippetComponent } from './code-snippet.component';
import { ImageGalleryComponent } from './image-gallery.component';

describe('CalloutBoxComponent', () => {
  let fixture: ComponentFixture<CalloutBoxComponent>;
  let component: CalloutBoxComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalloutBoxComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CalloutBoxComponent);
    component = fixture.componentInstance;
  });

  it('renders the default content with the info variant class', () => {
    fixture.detectChanges();

    const box = fixture.nativeElement.querySelector('.callout-box');
    expect(box.classList.contains('callout-info')).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.callout-text').textContent
    ).toContain('This is a callout box component.');
  });

  it('omits the title block when no title is set', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.callout-title')).toBeNull();
  });

  it.each(['warning', 'success', 'error'] as const)(
    'applies the %s variant class and renders the title',
    (type) => {
      component.type = type;
      component.title = 'Heads up';
      component.content = 'Body copy';
      fixture.detectChanges();

      expect(
        fixture.nativeElement
          .querySelector('.callout-box')
          .classList.contains(`callout-${type}`)
      ).toBe(true);
      expect(
        fixture.nativeElement.querySelector('.callout-title').textContent
      ).toContain('Heads up');
      expect(
        fixture.nativeElement.querySelector('.callout-text').textContent
      ).toContain('Body copy');
    }
  );
});

describe('CodeSnippetComponent', () => {
  let fixture: ComponentFixture<CodeSnippetComponent>;
  let component: CodeSnippetComponent;
  let writeText: jest.Mock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeSnippetComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CodeSnippetComponent);
    component = fixture.componentInstance;

    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
  });

  it('renders the code inside a language-tagged code element', () => {
    component.code = 'const a = 1;';
    component.language = 'typescript';
    fixture.detectChanges();

    const code = fixture.nativeElement.querySelector('.code-content code');
    expect(code.textContent).toContain('const a = 1;');
    expect(code.classList.contains('language-typescript')).toBe(true);
  });

  it('hides the header when neither a title nor a language is set', () => {
    component.language = '';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.code-header')).toBeNull();
  });

  it('copies the current code to the clipboard', async () => {
    component.code = 'copy me';

    await component.copyCode();

    expect(writeText).toHaveBeenCalledWith('copy me');
  });

  it('logs rather than throwing when the clipboard write fails', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation();
    writeText.mockRejectedValue(new Error('denied'));

    await expect(component.copyCode()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      'Failed to copy code:',
      expect.any(Error)
    );
    error.mockRestore();
  });
});

describe('ImageGalleryComponent', () => {
  let fixture: ComponentFixture<ImageGalleryComponent>;
  let component: ImageGalleryComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageGalleryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageGalleryComponent);
    component = fixture.componentInstance;
  });

  it('renders the sample images in a three-column grid by default', () => {
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.gallery-grid')
        .classList.contains('columns-3')
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelectorAll('.gallery-item')
    ).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('.gallery-header')).toBeNull();
  });

  it('renders a header, custom images and captions', () => {
    component.title = 'Trip photos';
    component.columns = 2;
    component.images = [
      { url: '/a.png', alt: 'A', caption: 'First' },
      { url: '/b.png' },
    ];
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.gallery-header h3').textContent
    ).toContain('Trip photos');
    expect(
      fixture.nativeElement
        .querySelector('.gallery-grid')
        .classList.contains('columns-2')
    ).toBe(true);

    const images: HTMLImageElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.gallery-item img')
    );
    expect(images[0].getAttribute('alt')).toBe('A');
    expect(images[1].getAttribute('alt')).toBe('Gallery image');

    const overlays = fixture.nativeElement.querySelectorAll('.image-overlay');
    expect(overlays).toHaveLength(1);
    expect(overlays[0].textContent).toContain('First');
  });

  it('logs the image picked by index when an item is clicked', () => {
    const log = jest.spyOn(console, 'log').mockImplementation();
    component.images = [{ url: '/a.png' }, { url: '/b.png' }];
    fixture.detectChanges();

    const items: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.gallery-item')
    );
    items[1].click();

    expect(log).toHaveBeenCalledWith('Selected image:', { url: '/b.png' });
    log.mockRestore();
  });
});
