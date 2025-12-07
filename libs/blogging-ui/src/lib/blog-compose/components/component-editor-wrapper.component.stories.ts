import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Component, Input } from '@angular/core';

import { ComponentEditorWrapperComponent } from './component-editor-wrapper.component';
import { InjectedComponentInstance, InjectableComponent } from '../interfaces/component-injection.interface';

// Sample component for demonstration
@Component({
  selector: 'sample-injected-component',
  template: `
    <div style="padding: 1rem; background: #f0f7ff; border-radius: 8px; border-left: 4px solid #007acc;">
      <h4 style="margin: 0 0 0.5rem 0; color: #007acc;">{{ title }}</h4>
      <p style="margin: 0; color: #333;">{{ content }}</p>
    </div>
  `,
  standalone: true,
})
class SampleInjectedComponent {
  @Input() title = 'Sample Component';
  @Input() content = 'This is a sample injected component.';
}

const mockComponentDef: InjectableComponent = {
  id: 'sample-component',
  name: 'Sample Component',
  description: 'A sample component for demonstration purposes',
  component: SampleInjectedComponent,
  category: 'Demo',
  icon: 'star',
  data: {
    title: 'Sample Title',
    content: 'This is sample content for the component.'
  }
};

const mockComponentInstance: InjectedComponentInstance = {
  instanceId: 'sample-instance-123',
  componentDef: mockComponentDef,
  componentRef: {
    instance: { title: 'Instance Title' },
    changeDetectorRef: { detectChanges: () => {} },
    destroy: () => {}
  } as any,
  data: {
    title: 'Sample Title',
    content: 'This is sample content for the component.'
  }
};

const meta: Meta<ComponentEditorWrapperComponent> = {
  title: 'Blogging UI/Component Editor Wrapper',
  component: ComponentEditorWrapperComponent,
  decorators: [
    moduleMetadata({
      imports: [FormsModule, MatIconModule, SampleInjectedComponent],
    }),
  ],
  parameters: {
    docs: {
      description: {
        component: `
The ComponentEditorWrapperComponent wraps injected Angular components within the blog editor.
It provides:
- Dynamic component rendering
- Inline editing controls (edit, duplicate, delete, configure)
- Quick edit mode for inline property modification
- Property preview for key component values
- Selection and hover visual states
        `,
      },
    },
  },
  argTypes: {
    isSelected: {
      control: 'boolean',
      description: 'Whether the component is selected',
    },
    isResizable: {
      control: 'boolean',
      description: 'Whether to show resize handles',
    },
  },
};

export default meta;

type Story = StoryObj<ComponentEditorWrapperComponent>;

export const Default: Story = {
  args: {
    componentInstance: mockComponentInstance,
    componentDef: mockComponentDef,
    componentData: mockComponentDef.data,
    isSelected: false,
    isResizable: false,
  },
};

export const Selected: Story = {
  args: {
    ...Default.args,
    isSelected: true,
  },
};

export const WithResizeHandle: Story = {
  args: {
    ...Default.args,
    isSelected: true,
    isResizable: true,
  },
};

export const WithDifferentData: Story = {
  args: {
    componentInstance: {
      ...mockComponentInstance,
      data: {
        title: 'Custom Title',
        content: 'This component has custom data values that differ from defaults.',
      },
    },
    componentDef: mockComponentDef,
    componentData: {
      title: 'Custom Title',
      content: 'This component has custom data values that differ from defaults.',
    },
    isSelected: false,
    isResizable: false,
  },
};
