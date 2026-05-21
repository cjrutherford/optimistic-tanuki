import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RichTextToolbarComponent } from './rich-text-toolbar.component';
import { Editor } from '@tiptap/core';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { heroBold } from '@ng-icons/heroicons/outline';

// Mock NgIcon component to avoid dealing with icon rendering complexity in tests
import { Component, Input } from '@angular/core';

@Component({
  selector: 'ng-icon',
  standalone: true,
  template: ''
})
class MockNgIconComponent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() name: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() size: any;
}

describe('RichTextToolbarComponent', () => {
  let component: RichTextToolbarComponent;
  let fixture: ComponentFixture<RichTextToolbarComponent>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let editorMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chainMock: any;

  beforeEach(async () => {
    // Setup Editor mock with chainable methods
    chainMock = {
      focus: jest.fn().mockReturnThis(),
      toggleBold: jest.fn().mockReturnThis(),
      toggleItalic: jest.fn().mockReturnThis(),
      toggleUnderline: jest.fn().mockReturnThis(),
      toggleStrike: jest.fn().mockReturnThis(),
      toggleHeading: jest.fn().mockReturnThis(),
      toggleBulletList: jest.fn().mockReturnThis(),
      toggleOrderedList: jest.fn().mockReturnThis(),
      toggleBlockquote: jest.fn().mockReturnThis(),
      toggleCodeBlock: jest.fn().mockReturnThis(),
      setTextAlign: jest.fn().mockReturnThis(),
      insertTable: jest.fn().mockReturnThis(),
      undo: jest.fn().mockReturnThis(),
      redo: jest.fn().mockReturnThis(),
      setLink: jest.fn().mockReturnThis(),
      addColumnBefore: jest.fn().mockReturnThis(),
      addColumnAfter: jest.fn().mockReturnThis(),
      deleteColumn: jest.fn().mockReturnThis(),
      addRowBefore: jest.fn().mockReturnThis(),
      addRowAfter: jest.fn().mockReturnThis(),
      deleteRow: jest.fn().mockReturnThis(),
      deleteTable: jest.fn().mockReturnThis(),
      run: jest.fn()
    };

    editorMock = {
      chain: jest.fn().mockReturnValue(chainMock),
      isActive: jest.fn().mockReturnValue(false)
    };

    await TestBed.configureTestingModule({
      imports: [RichTextToolbarComponent],
      providers: [
        provideIcons({ heroBold }) // Provide at least one icon to satisfy provider requirement if needed
      ]
    })
    .overrideComponent(RichTextToolbarComponent, {
      remove: { imports: [NgIcon] },
      add: { imports: [MockNgIconComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(RichTextToolbarComponent);
    component = fixture.componentInstance;
    component.editor = editorMock as unknown as Editor;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit componentsClicked event', () => {
    jest.spyOn(component.componentsClicked, 'emit');
    component.onComponentsClick();
    expect(component.componentsClicked.emit).toHaveBeenCalled();
  });

  it('should emit imageUploadClicked event', () => {
    jest.spyOn(component.imageUploadClicked, 'emit');
    component.onImageUploadClick();
    expect(component.imageUploadClicked.emit).toHaveBeenCalled();
  });

  describe('Toolbar Groups', () => {
    it('should generate toolbar groups', () => {
      const groups = component.toolbarGroups;
      expect(groups.length).toBeGreaterThan(0);
      expect(groups.find(g => g.name === 'Format')).toBeDefined();
    });

    it('should show table management tools when table is active', () => {
      editorMock.isActive.mockReturnValue(true); // Simulate table active
      const groups = component.toolbarGroups;
      const tableGroup = groups.find(g => g.name === 'Table Management');
      expect(tableGroup).toBeDefined();
    });

    it('should NOT show table management tools when table is inactive', () => {
      editorMock.isActive.mockReturnValue(false);
      const groups = component.toolbarGroups;
      const tableGroup = groups.find(g => g.name === 'Table Management');
      expect(tableGroup).toBeUndefined();
    });
  });

  describe('Tool Actions', () => {
    it('should execute bold action', () => {
      const tool = component.toolbarGroups[0].tools.find(t => t.id === 'bold');
      tool?.action();
      expect(chainMock.toggleBold).toHaveBeenCalled();
      expect(chainMock.run).toHaveBeenCalled();
    });

    it('should execute heading action', () => {
      const tool = component.toolbarGroups[1].tools.find(t => t.id === 'heading1');
      tool?.action();
      expect(chainMock.toggleHeading).toHaveBeenCalledWith({ level: 1 });
    });

    it('should execute text align action', () => {
        const tool = component.toolbarGroups[2].tools.find(t => t.id === 'alignLeft');
        tool?.action();
        expect(chainMock.setTextAlign).toHaveBeenCalledWith('left');
    });

    it('should execute undo action', () => {
        const groups = component.toolbarGroups;
        const actionGroup = groups.find(g => g.name === 'Actions');
        const tool = actionGroup?.tools.find(t => t.id === 'undo');
        tool?.action();
        expect(chainMock.undo).toHaveBeenCalled();
    });

    it('should prompt for URL and set link', () => {
        const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('http://example.com');
        const groups = component.toolbarGroups;
        const mediaGroup = groups.find(g => g.name === 'Media & Tables');
        const tool = mediaGroup?.tools.find(t => t.id === 'link');
        
        tool?.action();
        
        expect(promptSpy).toHaveBeenCalled();
        expect(chainMock.setLink).toHaveBeenCalledWith({ href: 'http://example.com' });
    });

    it('should not set link if prompt is cancelled', () => {
        jest.spyOn(window, 'prompt').mockReturnValue(null);
        const groups = component.toolbarGroups;
        const mediaGroup = groups.find(g => g.name === 'Media & Tables');
        const tool = mediaGroup?.tools.find(t => t.id === 'link');
        
        tool?.action();
        
        expect(chainMock.setLink).not.toHaveBeenCalled();
    });
  });
});
