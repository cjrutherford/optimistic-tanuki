import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  RichTextToolbarComponent,
  ToolbarTool,
} from './rich-text-toolbar.component';

function toolsById(
  component: RichTextToolbarComponent
): Map<string, ToolbarTool> {
  const map = new Map<string, ToolbarTool>();
  component.toolbarGroups.forEach((group) =>
    group.tools.forEach((tool) => map.set(tool.id, tool))
  );
  return map;
}

describe('RichTextToolbarComponent', () => {
  let fixture: ComponentFixture<RichTextToolbarComponent>;
  let component: RichTextToolbarComponent;
  let editor: Editor;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichTextToolbarComponent],
    }).compileComponents();

    editor = new Editor({
      extensions: [
        StarterKit,
        Underline,
        Link,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: '<p>Hello toolbar</p>',
    });

    fixture = TestBed.createComponent(RichTextToolbarComponent);
    component = fixture.componentInstance;
    component.editor = editor;
    fixture.detectChanges();
  });

  afterEach(() => {
    editor.destroy();
  });

  it('exposes the five base groups when the cursor is outside a table', () => {
    expect(component.toolbarGroups.map((g) => g.name)).toEqual([
      'Format',
      'Structure',
      'Alignment',
      'Media & Tables',
      'Actions',
    ]);
  });

  describe.each([
    ['bold', 'bold'],
    ['italic', 'italic'],
    ['underline', 'underline'],
    ['strikethrough', 'strike'],
  ])('%s tool', (toolId, markName) => {
    it(`toggles the ${markName} mark over the selection`, () => {
      editor.commands.selectAll();
      const tool = toolsById(component).get(toolId)!;

      expect(tool.isActive?.()).toBe(false);
      tool.action();

      expect(editor.isActive(markName)).toBe(true);
      expect(tool.isActive?.()).toBe(true);
    });
  });

  describe.each([
    ['bulletList', 'bulletList'],
    ['orderedList', 'orderedList'],
    ['blockquote', 'blockquote'],
    ['codeBlock', 'codeBlock'],
  ])('%s tool', (toolId, nodeName) => {
    it(`wraps the current block in ${nodeName}`, () => {
      const tool = toolsById(component).get(toolId)!;

      expect(tool.isActive?.()).toBe(false);
      tool.action();

      expect(editor.isActive(nodeName)).toBe(true);
      expect(tool.isActive?.()).toBe(true);
    });
  });

  describe.each([
    ['heading1', 1],
    ['heading2', 2],
  ])('%s tool', (toolId, level) => {
    it(`toggles a level ${level} heading`, () => {
      const tool = toolsById(component).get(toolId)!;

      tool.action();

      expect(editor.isActive('heading', { level })).toBe(true);
      expect(tool.isActive?.()).toBe(true);
    });
  });

  describe.each([
    ['alignLeft', 'left'],
    ['alignCenter', 'center'],
    ['alignRight', 'right'],
    ['alignJustify', 'justify'],
  ])('%s tool', (toolId, alignment) => {
    it(`sets text alignment to ${alignment}`, () => {
      const tool = toolsById(component).get(toolId)!;

      tool.action();

      expect(editor.isActive({ textAlign: alignment })).toBe(true);
      expect(tool.isActive?.()).toBe(true);
    });
  });

  it('inserts a 3x3 table with a header row', () => {
    toolsById(component).get('table')!.action();

    expect(editor.isActive('table')).toBe(true);
    expect(editor.getHTML()).toContain('<th');
  });

  it('adds table management tools once the cursor sits inside a table', () => {
    expect(component.toolbarGroups.map((g) => g.name)).not.toContain(
      'Table Management'
    );

    toolsById(component).get('table')!.action();

    expect(component.toolbarGroups.map((g) => g.name)).toEqual([
      'Format',
      'Structure',
      'Alignment',
      'Media & Tables',
      'Table Management',
      'Actions',
    ]);
  });

  describe('table management tools', () => {
    beforeEach(() => {
      toolsById(component).get('table')!.action();
    });

    it.each([
      ['addColumnBefore', 4, 3],
      ['addColumnAfter', 4, 3],
      ['addRowBefore', 3, 4],
      ['addRowAfter', 3, 4],
      ['deleteColumn', 2, 3],
      ['deleteRow', 3, 2],
    ])('%s reshapes the table', (toolId, expectedCols, expectedRows) => {
      toolsById(component).get(toolId)!.action();

      const rows = editor.view.dom.querySelectorAll('tr');
      expect(rows).toHaveLength(expectedRows);
      expect(rows[0].children).toHaveLength(expectedCols);
    });

    it('deleteTable removes the table entirely', () => {
      toolsById(component).get('deleteTable')!.action();

      expect(editor.isActive('table')).toBe(false);
      expect(editor.getHTML()).not.toContain('<table');
    });
  });

  it('undo and redo walk the editor history', () => {
    editor.commands.setContent('<p>first</p>');
    editor.commands.insertContent(' second');
    const withSecond = editor.getHTML();

    toolsById(component).get('undo')!.action();
    expect(editor.getHTML()).not.toBe(withSecond);

    toolsById(component).get('redo')!.action();
    expect(editor.getHTML()).toBe(withSecond);
  });

  it('emits imageUploadClicked from the image tool', () => {
    const emitted = jest.fn();
    component.imageUploadClicked.subscribe(emitted);

    toolsById(component).get('image')!.action();

    expect(emitted).toHaveBeenCalled();
  });

  it('emits componentsClicked when the components button is pressed', () => {
    const emitted = jest.fn();
    component.componentsClicked.subscribe(emitted);

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('.component-btn');
    button.click();

    expect(emitted).toHaveBeenCalled();
  });

  describe('link tool', () => {
    let promptSpy: jest.SpyInstance;

    afterEach(() => {
      promptSpy.mockRestore();
    });

    it('applies the prompted URL as a link on the selection', () => {
      promptSpy = jest
        .spyOn(window, 'prompt')
        .mockReturnValue('https://example.com');
      editor.commands.selectAll();

      toolsById(component).get('link')!.action();

      expect(editor.isActive('link')).toBe(true);
      expect(editor.getHTML()).toContain('href="https://example.com"');
    });

    it('leaves the document untouched when the prompt is cancelled', () => {
      promptSpy = jest.spyOn(window, 'prompt').mockReturnValue(null);
      editor.commands.selectAll();
      const before = editor.getHTML();

      toolsById(component).get('link')!.action();

      expect(editor.getHTML()).toBe(before);
    });
  });

  it('renders a button per tool and marks active ones', () => {
    editor.commands.selectAll();
    toolsById(component).get('bold')!.action();
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.toolbar-btn')
    );
    const boldButton = buttons.find((b) => b.title === 'Bold (Ctrl+B)');

    expect(boldButton?.classList.contains('is-active')).toBe(true);
  });
});
