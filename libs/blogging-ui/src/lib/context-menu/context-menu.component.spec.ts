import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenuComponent } from './context-menu.component';
import { Editor } from '@tiptap/core';

describe('ContextMenuComponent', () => {
  let component: ContextMenuComponent;
  let fixture: ComponentFixture<ContextMenuComponent>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let editorMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chainMock: any;

  beforeEach(async () => {
    // Mock Editor
    chainMock = {
      focus: jest.fn().mockReturnThis(),
      deleteSelection: jest.fn().mockReturnThis(),
      insertContent: jest.fn().mockReturnThis(),
      run: jest.fn()
    };
    
    editorMock = {
      chain: jest.fn().mockReturnValue(chainMock),
      state: {
        selection: { from: 0, to: 5 },
        doc: {
          textBetween: jest.fn().mockReturnValue('Selected Text')
        }
      }
    };

    // Mock Navigator Clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
        readText: jest.fn().mockResolvedValue('Clipboard Content')
      }
    });

    await TestBed.configureTestingModule({
      imports: [ContextMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContextMenuComponent);
    component = fixture.componentInstance;
    component.editor = editorMock as unknown as Editor;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Copy', () => {
    it('should copy selected text to clipboard', async () => {
      await component.copy();
      
      expect(editorMock.state.doc.textBetween).toHaveBeenCalledWith(0, 5);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Selected Text');
    });

    it('should not copy if no text selected/returned', async () => {
      editorMock.state.doc.textBetween.mockReturnValue('');
      await component.copy();
      
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe('Cut', () => {
    it('should copy text and delete selection', async () => {
      // Spy on copy to ensure it's called (optional, but good for verification)
      jest.spyOn(component, 'copy');
      
      await component.cut();
      
      expect(component.copy).toHaveBeenCalled();
      // Since copy is async and called with await, we expect writeText to have been called
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Selected Text');
      
      expect(chainMock.deleteSelection).toHaveBeenCalled();
      expect(chainMock.run).toHaveBeenCalled();
    });
  });

  describe('Paste', () => {
    it('should read from clipboard and insert content', async () => {
      await component.paste();
      
      expect(navigator.clipboard.readText).toHaveBeenCalled();
      expect(chainMock.insertContent).toHaveBeenCalledWith('Clipboard Content');
      expect(chainMock.run).toHaveBeenCalled();
    });

    it('should not insert if clipboard is empty', async () => {
      (navigator.clipboard.readText as jest.Mock).mockResolvedValue('');
      await component.paste();
      
      expect(chainMock.insertContent).not.toHaveBeenCalled();
    });
  });
});
