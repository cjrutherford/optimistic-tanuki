import type { Meta, StoryObj } from '@storybook/angular';
import { RichTextToolbarComponent } from './rich-text-toolbar.component';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';

const meta: Meta<RichTextToolbarComponent> = {
  component: RichTextToolbarComponent,
  title: 'RichTextToolbarComponent',
  parameters: {
    docs: {
      description: {
        component: 'A rich text editing toolbar component with grouped tools and ng-icons integration',
      },
    },
  },
};
export default meta;
type Story = StoryObj<RichTextToolbarComponent>;

// Create a mock editor for the stories
const createMockEditor = () => {
  return {
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: () => {} }),
        toggleItalic: () => ({ run: () => {} }),
        toggleUnderline: () => ({ run: () => {} }),
        toggleStrike: () => ({ run: () => {} }),
        toggleHeading: () => ({ run: () => {} }),
        toggleBulletList: () => ({ run: () => {} }),
        toggleOrderedList: () => ({ run: () => {} }),
        toggleBlockquote: () => ({ run: () => {} }),
        toggleCodeBlock: () => ({ run: () => {} }),
        setTextAlign: () => ({ run: () => {} }),
        setLink: () => ({ run: () => {} }),
        insertTable: () => ({ run: () => {} }),
        addColumnBefore: () => ({ run: () => {} }),
        addColumnAfter: () => ({ run: () => {} }),
        deleteColumn: () => ({ run: () => {} }),
        addRowBefore: () => ({ run: () => {} }),
        addRowAfter: () => ({ run: () => {} }),
        deleteRow: () => ({ run: () => {} }),
        deleteTable: () => ({ run: () => {} }),
        undo: () => ({ run: () => {} }),
        redo: () => ({ run: () => {} }),
      }),
    }),
    isActive: (format: string, options?: any) => {
      // Mock some active states for demonstration
      if (format === 'bold') return true;
      if (format === 'heading' && options?.level === 1) return true;
      return false;
    },
  } as any;
};

const createTableActiveEditor = () => {
  const editor = createMockEditor();
  editor.isActive = (format: string, options?: any) => {
    if (format === 'table') return true;
    if (format === 'bold') return true;
    return false;
  };
  return editor;
};

export const Default: Story = {
  args: {
    editor: createMockEditor(),
  },
};

export const WithTableActive: Story = {
  args: {
    editor: createTableActiveEditor(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the toolbar when cursor is inside a table, displaying additional table management tools',
      },
    },
  },
};

export const Interactive: Story = {
  args: {
    editor: createMockEditor(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive toolbar that responds to clicks (actions are mocked for demo)',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    // This story can be extended with interactive tests
    const toolbar = canvasElement.querySelector('.toolbar-container');
    if (toolbar) {
      console.log('Toolbar rendered successfully');
    }
  },
};