import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { 
  heroBold,
  heroItalic,
  heroListBullet,
  heroNumberedList,
  heroLink,
  heroPhoto,
  heroArrowUturnLeft,
  heroArrowUturnRight,
  heroQueueList
} from '@ng-icons/heroicons/outline';
import { 
  matFormatBold,
  matFormatItalic,
  matFormatUnderlined,
  matFormatStrikethrough,
  matFormatListBulleted,
  matFormatListNumbered,
  matFormatQuote,
  matCode,
  matImage,
  matLink,
  matTableChart,
  matFormatAlignLeft,
  matFormatAlignCenter,
  matFormatAlignRight,
  matFormatAlignJustify,
  matTitle,
  matSubtitles,
  matUndo,
  matRedo,
  matExtension,
  matTableRows,
  matTableView,
  matDeleteOutline
} from '@ng-icons/material-icons/baseline';
import { Editor } from '@tiptap/core';

export interface ToolbarGroup {
  name: string;
  tools: ToolbarTool[];
}

export interface ToolbarTool {
  id: string;
  name: string;
  icon: string;
  action: () => void;
  isActive?: () => boolean;
  tooltip: string;
}

@Component({
  selector: 'lib-rich-text-toolbar',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      // Heroicons
      heroBold,
      heroItalic,
      heroListBullet,
      heroNumberedList,
      heroLink,
      heroPhoto,
      heroArrowUturnLeft,
      heroArrowUturnRight,
      heroQueueList,
      // Material Icons
      matFormatBold,
      matFormatItalic,
      matFormatUnderlined,
      matFormatStrikethrough,
      matFormatListBulleted,
      matFormatListNumbered,
      matFormatQuote,
      matCode,
      matImage,
      matLink,
      matTableChart,
      matFormatAlignLeft,
      matFormatAlignCenter,
      matFormatAlignRight,
      matFormatAlignJustify,
      matTitle,
      matSubtitles,
      matUndo,
      matRedo,
      matExtension,
      matTableRows,
      matTableView,
      matDeleteOutline
    })
  ],
  template: `
    <div class="toolbar-container">
      @for (group of toolbarGroups; track group.name) {
        <div class="toolbar-group">
          <div class="toolbar-group-name">{{ group.name }}</div>
          <div class="toolbar-buttons">
            @for (tool of group.tools; track tool.id) {
              <button
                type="button"
                class="toolbar-btn"
                [class.is-active]="tool.isActive ? tool.isActive() : false"
                [title]="tool.tooltip"
                (click)="tool.action()"
              >
                <ng-icon [name]="tool.icon" size="16"></ng-icon>
              </button>
            }
          </div>
        </div>
        @if (!$last) {
          <div class="toolbar-separator"></div>
        }
      }
      
      <!-- Component injection section -->
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <div class="toolbar-group-name">Components</div>
        <div class="toolbar-buttons">
          <button
            type="button"
            class="toolbar-btn component-btn"
            title="Insert Component"
            (click)="onComponentsClick()"
          >
            <ng-icon name="matExtension" size="16"></ng-icon>
            <span>Components</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./rich-text-toolbar.component.scss']
})
export class RichTextToolbarComponent {
  @Input({ required: true }) editor!: Editor;
  @Output() componentsClicked = new EventEmitter<void>();
  @Output() imageUploadClicked = new EventEmitter<void>();

  get toolbarGroups(): ToolbarGroup[] {
    const baseGroups: ToolbarGroup[] = [
      {
        name: 'Format',
        tools: [
          {
            id: 'bold',
            name: 'Bold',
            icon: 'matFormatBold',
            action: () => this.editor.chain().focus().toggleBold().run(),
            isActive: () => this.editor.isActive('bold'),
            tooltip: 'Bold (Ctrl+B)'
          },
          {
            id: 'italic',
            name: 'Italic',
            icon: 'matFormatItalic',
            action: () => this.editor.chain().focus().toggleItalic().run(),
            isActive: () => this.editor.isActive('italic'),
            tooltip: 'Italic (Ctrl+I)'
          },
          {
            id: 'underline',
            name: 'Underline',
            icon: 'matFormatUnderlined',
            action: () => this.editor.chain().focus().toggleUnderline().run(),
            isActive: () => this.editor.isActive('underline'),
            tooltip: 'Underline (Ctrl+U)'
          },
          {
            id: 'strikethrough',
            name: 'Strikethrough',
            icon: 'matFormatStrikethrough',
            action: () => this.editor.chain().focus().toggleStrike().run(),
            isActive: () => this.editor.isActive('strike'),
            tooltip: 'Strikethrough'
          }
        ]
      },
      {
        name: 'Structure',
        tools: [
          {
            id: 'heading1',
            name: 'Heading 1',
            icon: 'matTitle',
            action: () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
            isActive: () => this.editor.isActive('heading', { level: 1 }),
            tooltip: 'Heading 1'
          },
          {
            id: 'heading2',
            name: 'Heading 2',
            icon: 'matSubtitles',
            action: () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
            isActive: () => this.editor.isActive('heading', { level: 2 }),
            tooltip: 'Heading 2'
          },
          {
            id: 'bulletList',
            name: 'Bullet List',
            icon: 'matFormatListBulleted',
            action: () => this.editor.chain().focus().toggleBulletList().run(),
            isActive: () => this.editor.isActive('bulletList'),
            tooltip: 'Bullet List'
          },
          {
            id: 'orderedList',
            name: 'Numbered List',
            icon: 'matFormatListNumbered',
            action: () => this.editor.chain().focus().toggleOrderedList().run(),
            isActive: () => this.editor.isActive('orderedList'),
            tooltip: 'Numbered List'
          },
          {
            id: 'blockquote',
            name: 'Blockquote',
            icon: 'matFormatQuote',
            action: () => this.editor.chain().focus().toggleBlockquote().run(),
            isActive: () => this.editor.isActive('blockquote'),
            tooltip: 'Blockquote'
          },
          {
            id: 'codeBlock',
            name: 'Code Block',
            icon: 'matCode',
            action: () => this.editor.chain().focus().toggleCodeBlock().run(),
            isActive: () => this.editor.isActive('codeBlock'),
            tooltip: 'Code Block'
          }
        ]
      },
      {
        name: 'Alignment',
        tools: [
          {
            id: 'alignLeft',
            name: 'Align Left',
            icon: 'matFormatAlignLeft',
            action: () => this.editor.chain().focus().setTextAlign('left').run(),
            isActive: () => this.editor.isActive({ textAlign: 'left' }),
            tooltip: 'Align Left'
          },
          {
            id: 'alignCenter',
            name: 'Align Center',
            icon: 'matFormatAlignCenter',
            action: () => this.editor.chain().focus().setTextAlign('center').run(),
            isActive: () => this.editor.isActive({ textAlign: 'center' }),
            tooltip: 'Align Center'
          },
          {
            id: 'alignRight',
            name: 'Align Right',
            icon: 'matFormatAlignRight',
            action: () => this.editor.chain().focus().setTextAlign('right').run(),
            isActive: () => this.editor.isActive({ textAlign: 'right' }),
            tooltip: 'Align Right'
          },
          {
            id: 'alignJustify',
            name: 'Justify',
            icon: 'matFormatAlignJustify',
            action: () => this.editor.chain().focus().setTextAlign('justify').run(),
            isActive: () => this.editor.isActive({ textAlign: 'justify' }),
            tooltip: 'Justify'
          }
        ]
      },
      {
        name: 'Media & Tables',
        tools: [
          {
            id: 'image',
            name: 'Insert Image',
            icon: 'matImage',
            action: () => this.onImageUploadClick(),
            tooltip: 'Insert Image'
          },
          {
            id: 'link',
            name: 'Insert Link',
            icon: 'matLink',
            action: () => this.insertLink(),
            tooltip: 'Insert Link'
          },
          {
            id: 'table',
            name: 'Insert Table',
            icon: 'matTableChart',
            action: () => this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
            tooltip: 'Insert Table'
          }
        ]
      },
      {
        name: 'Actions',
        tools: [
          {
            id: 'undo',
            name: 'Undo',
            icon: 'matUndo',
            action: () => this.editor.chain().focus().undo().run(),
            tooltip: 'Undo (Ctrl+Z)'
          },
          {
            id: 'redo',
            name: 'Redo',
            icon: 'matRedo',
            action: () => this.editor.chain().focus().redo().run(),
            tooltip: 'Redo (Ctrl+Y)'
          }
        ]
      }
    ];

    // Add table management tools if cursor is in a table
    if (this.editor.isActive('table')) {
      baseGroups.splice(4, 0, {
        name: 'Table Management',
        tools: [
          {
            id: 'addColumnBefore',
            name: 'Add Column Before',
            icon: 'matTableView',
            action: () => this.editor.chain().focus().addColumnBefore().run(),
            tooltip: 'Add Column Before'
          },
          {
            id: 'addColumnAfter',
            name: 'Add Column After',
            icon: 'matTableView',
            action: () => this.editor.chain().focus().addColumnAfter().run(),
            tooltip: 'Add Column After'
          },
          {
            id: 'deleteColumn',
            name: 'Delete Column',
            icon: 'matDeleteOutline',
            action: () => this.editor.chain().focus().deleteColumn().run(),
            tooltip: 'Delete Column'
          },
          {
            id: 'addRowBefore',
            name: 'Add Row Before',
            icon: 'matTableRows',
            action: () => this.editor.chain().focus().addRowBefore().run(),
            tooltip: 'Add Row Before'
          },
          {
            id: 'addRowAfter',
            name: 'Add Row After',
            icon: 'matTableRows',
            action: () => this.editor.chain().focus().addRowAfter().run(),
            tooltip: 'Add Row After'
          },
          {
            id: 'deleteRow',
            name: 'Delete Row',
            icon: 'matDeleteOutline',
            action: () => this.editor.chain().focus().deleteRow().run(),
            tooltip: 'Delete Row'
          },
          {
            id: 'deleteTable',
            name: 'Delete Table',
            icon: 'matDeleteOutline',
            action: () => this.editor.chain().focus().deleteTable().run(),
            tooltip: 'Delete Table'
          }
        ]
      });
    }

    return baseGroups;
  }

  onComponentsClick(): void {
    this.componentsClicked.emit();
  }

  onImageUploadClick(): void {
    this.imageUploadClicked.emit();
  }

  private insertLink(): void {
    const url = window.prompt('Enter URL:');
    if (url) {
      this.editor.chain().focus().setLink({ href: url }).run();
    }
  }
}