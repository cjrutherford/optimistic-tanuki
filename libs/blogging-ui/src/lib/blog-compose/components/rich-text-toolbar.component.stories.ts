import type { Meta, StoryObj } from '@storybook/angular';
import { RichTextToolbarComponent } from './rich-text-toolbar.component';

const meta: Meta<RichTextToolbarComponent> = {
  component: RichTextToolbarComponent,
  title: 'RichTextToolbarComponent',
  parameters: {
    docs: {
      description: {
        component:
          'A rich text editing toolbar component with grouped tools and ng-icons integration',
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
        toggleBold: () => ({ run: () => true }),
        toggleItalic: () => ({ run: () => true }),
        toggleUnderline: () => ({ run: () => true }),
        toggleStrike: () => ({ run: () => true }),
        toggleHeading: () => ({ run: () => true }),
        toggleBulletList: () => ({ run: () => true }),
        toggleOrderedList: () => ({ run: () => true }),
        toggleBlockquote: () => ({ run: () => true }),
        toggleCodeBlock: () => ({ run: () => true }),
        setTextAlign: () => ({ run: () => true }),
        setLink: () => ({ run: () => true }),
        insertTable: () => ({ run: () => true }),
        addColumnBefore: () => ({ run: () => true }),
        addColumnAfter: () => ({ run: () => true }),
        deleteColumn: () => ({ run: () => true }),
        addRowBefore: () => ({ run: () => true }),
        addRowAfter: () => ({ run: () => true }),
        deleteRow: () => ({ run: () => true }),
        deleteTable: () => ({ run: () => true }),
        undo: () => ({ run: () => true }),
        redo: () => ({ run: () => true }),
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
        story:
          'Shows the toolbar when cursor is inside a table, displaying additional table management tools',
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
        story:
          'Interactive toolbar that responds to clicks (actions are mocked for demo)',
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
