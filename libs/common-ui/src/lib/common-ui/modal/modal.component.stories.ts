/* eslint-disable @typescript-eslint/no-empty-function */
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ModalComponent, ModalSize, ModalPosition } from './modal.component';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';

const meta: Meta<ModalComponent> = {
  component: ModalComponent,
  title: 'Components/Modal',
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ButtonComponent],
    }),
  ],
  parameters: {
    componentSubtitle: 'A fully accessible modal dialog with focus trap and theme support',
    docs: {
      description: {
        component: `
The Modal component provides an accessible dialog window for displaying content, forms, or confirmations.

## Features
- ✅ Full ARIA support (role="dialog", aria-modal, aria-labelledby)
- ✅ Focus trap for keyboard navigation
- ✅ Close on Escape key
- ✅ Backdrop click to close (optional)
- ✅ Body scroll lock when open
- ✅ Multiple sizes and positions
- ✅ Theme-aware with personality support
- ✅ Visual variants (default, glass, gradient, bordered)

## Migration Notice
**The old 'mode' input is deprecated.**
Please use 'position' and 'size' inputs instead:
- mode="sidebar" → position="sidebar-right"
- mode="sidebar-left" → position="sidebar-left"
- mode="trough" → position="bottom"
- mode="captive-modal" → position="center" + size="full"
- mode="standard-modal" → position="center" (default)
        `,
      },
    },
  },
  argTypes: {
    visible: {
      control: 'boolean',
      description: 'Controls modal visibility',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
      description: 'Modal size',
    },
    position: {
      control: 'select',
      options: ['center', 'top', 'sidebar-left', 'sidebar-right', 'bottom'],
      description: 'Modal position',
    },
    variant: {
      control: 'select',
      options: ['default', 'glass', 'gradient', 'bordered'],
      description: 'Visual variant',
    },
    closable: {
      control: 'boolean',
      description: 'Show close button',
    },
    backdrop: {
      control: 'boolean',
      description: 'Show backdrop overlay',
    },
    closeOnBackdrop: {
      control: 'boolean',
      description: 'Close when clicking backdrop',
    },
    closeOnEscape: {
      control: 'boolean',
      description: 'Close on Escape key',
    },
    focusTrap: {
      control: 'boolean',
      description: 'Trap focus within modal',
    },
    lockScroll: {
      control: 'boolean',
      description: 'Lock body scroll when open',
    },
  },
};
export default meta;
type Story = StoryObj<ModalComponent>;

// ==================== BASIC EXAMPLES ====================

export const Default: Story = {
  args: {
    visible: true,
    heading: 'Modal Title',
    size: 'md',
    position: 'center',
    closable: true,
    backdrop: true,
    closeOnBackdrop: true,
    closeOnEscape: true,
    ariaLabel: 'Example modal dialog',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 400px; position: relative;">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [size]="size"
          [position]="position"
          [closable]="closable"
          [backdrop]="backdrop"
          [closeOnBackdrop]="closeOnBackdrop"
          [closeOnEscape]="closeOnEscape"
          [ariaLabel]="ariaLabel"
        >
          <p>This is the modal content. It can contain any HTML or components.</p>
          <p>Press Escape or click outside to close (if enabled).</p>
        </otui-modal>
      </div>
    `,
  }),
};

export const Small: Story = {
  args: {
    visible: true,
    heading: 'Small Modal',
    size: 'sm',
    position: 'center',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 300px; position: relative;">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [size]="size"
          [position]="position"
        >
          <p>This is a small modal, perfect for confirmations.</p>
        </otui-modal>
      </div>
    `,
  }),
};

export const Large: Story = {
  args: {
    visible: true,
    heading: 'Large Modal',
    size: 'lg',
    position: 'center',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 500px; position: relative;">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [size]="size"
          [position]="position"
        >
          <p>This is a large modal for more complex content.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
        </otui-modal>
      </div>
    `,
  }),
};

// ==================== POSITION VARIANTS ====================

export const SidebarRight: Story = {
  args: {
    visible: true,
    heading: 'Sidebar Right',
    size: 'md',
    position: 'sidebar-right',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 400px; position: relative; overflow: hidden;">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [size]="size"
          [position]="position"
        >
          <p>This modal slides in from the right side.</p>
          <p>Great for detail panels or navigation.</p>
        </otui-modal>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'Sidebar modals slide in from the side and take up the full height.',
      },
    },
  },
};

export const SidebarLeft: Story = {
  args: {
    visible: true,
    heading: 'Sidebar Left',
    size: 'md',
    position: 'sidebar-left',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 400px; position: relative; overflow: hidden;">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [size]="size"
          [position]="position"
        >
          <p>This modal slides in from the left side.</p>
        </otui-modal>
      </div>
    `,
  }),
};

export const BottomSheet: Story = {
  args: {
    visible: true,
    heading: 'Bottom Sheet',
    size: 'md',
    position: 'bottom',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 400px; position: relative; overflow: hidden;">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [size]="size"
          [position]="position"
        >
          <p>This is a bottom sheet modal.</p>
          <p>Common on mobile for actions or selections.</p>
        </otui-modal>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'Bottom sheet modals slide up from the bottom, commonly used on mobile.',
      },
    },
  },
};

export const FullScreen: Story = {
  args: {
    visible: true,
    heading: 'Full Screen Modal',
    size: 'full',
    position: 'center',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 400px; position: relative;">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [size]="size"
          [position]="position"
        >
          <p>This modal takes up the entire screen.</p>
          <p>Useful for immersive experiences or mobile-first designs.</p>
        </otui-modal>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'Full-screen modals take up the entire viewport.',
      },
    },
  },
};

// ==================== VISUAL VARIANTS ====================

export const Glass: Story = {
  args: {
    visible: true,
    heading: 'Glass Modal',
    size: 'md',
    position: 'center',
    variant: 'glass',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 400px; position: relative; background: linear-gradient(45deg, #3f51b5, #c0af4b);">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [size]="size"
          [position]="position"
          [variant]="variant"
        >
          <p>This modal has a frosted glass effect.</p>
          <p>Perfect for modern, sleek interfaces.</p>
        </otui-modal>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'Glass variant uses a frosted glass effect with backdrop blur.',
      },
    },
  },
};

export const Gradient: Story = {
  args: {
    visible: true,
    heading: 'Gradient Modal',
    size: 'md',
    position: 'center',
    variant: 'gradient',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 400px; position: relative;">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [size]="size"
          [position]="position"
          [variant]="variant"
        >
          <p>This modal has a gradient background based on the theme colors.</p>
        </otui-modal>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'Gradient variant applies a theme-based gradient to the modal background.',
      },
    },
  },
};

export const Bordered: Story = {
  args: {
    visible: true,
    heading: 'Bordered Modal',
    size: 'md',
    position: 'center',
    variant: 'bordered',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 400px; position: relative;">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [size]="size"
          [position]="position"
          [variant]="variant"
        >
          <p>This modal has a prominent border.</p>
        </otui-modal>
      </div>
    `,
  }),
};

// ==================== ACCESSIBILITY STORY ====================

export const Accessibility: Story = {
  args: {
    visible: true,
    heading: 'Accessible Modal',
    size: 'md',
    position: 'center',
    ariaLabel: 'Example accessible modal',
    ariaDescribedBy: 'modal-description',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 400px; position: relative;">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [size]="size"
          [position]="position"
          [ariaLabel]="ariaLabel"
          [ariaDescribedBy]="ariaDescribedBy"
        >
          <p id="modal-description">
            This modal demonstrates accessibility features:
          </p>
          <ul>
            <li>✅ role="dialog" with aria-modal="true"</li>
            <li>✅ aria-label for screen readers</li>
            <li>✅ Focus trap keeps keyboard navigation inside</li>
            <li>✅ Escape key closes the modal</li>
            <li>✅ Return focus to trigger element on close</li>
          </ul>
        </otui-modal>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'This example showcases the accessibility features built into the modal component.',
      },
    },
  },
};

// ==================== INTERACTIVE EXAMPLE ====================

export const Interactive: Story = {
  args: {
    visible: false,
    heading: 'Interactive Modal',
    size: 'md',
    position: 'center',
  },
  render: (args) => ({
    props: {
      ...args,
      showModal: false,
    },
    template: `
      <div style="height: 400px; display: flex; align-items: center; justify-content: center;">
        <button (click)="showModal = true" style="padding: 12px 24px; font-size: 16px;">
          Open Modal
        </button>
        
        <otui-modal
          [visible]="showModal"
          [heading]="heading"
          [size]="size"
          [position]="position"
          (close)="showModal = false"
        >
          <p>This is an interactive modal example.</p>
          <p>Click the button below or outside to close.</p>
          
          <div modal-footer style="display: flex; gap: 8px; justify-content: flex-end;">
            <button (click)="showModal = false" style="padding: 8px 16px;">Cancel</button>
            <button (click)="showModal = false" style="padding: 8px 16px; background: #3f51b5; color: white;">Confirm</button>
          </div>
        </otui-modal>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: 'Interactive example showing how to control modal visibility programmatically.',
      },
    },
  },
};

// ==================== LEGACY MODE (Deprecated) ====================

export const LegacyModeSidebar: Story = {
  args: {
    visible: true,
    heading: 'Legacy Sidebar Mode',
    mode: 'sidebar',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 400px; position: relative; overflow: hidden;">
        <otui-modal
          [visible]="visible"
          [heading]="heading"
          [mode]="mode"
        >
          <p>This uses the deprecated "mode" input.</p>
          <p>Check the browser console for deprecation warnings.</p>
        </otui-modal>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story: `
**⚠️ DEPRECATED**

This example uses the legacy 'mode' input which is deprecated.
Use 'position="sidebar-right"' instead.
        `,
      },
    },
  },
};
