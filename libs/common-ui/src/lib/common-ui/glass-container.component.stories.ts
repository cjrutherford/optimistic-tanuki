import type { Meta, StoryObj } from '@storybook/angular';
import { GlassContainerComponent } from './glass-container.component';
// Streamlined: removed unused story/testing imports to avoid unused symbol warnings

const meta: Meta<GlassContainerComponent> = {
  component: GlassContainerComponent,
  title: 'GlassContainerComponent',
};
export default meta;
type Story = StoryObj<GlassContainerComponent>;

const HtmlTemplate = (args: Partial<GlassContainerComponent>) => ({
  props: args,
  imports: [GlassContainerComponent],
  template: `
    <otui-glass-container>
      <div style="padding: 16px; text-align: center;">
        <h2>Glass Container Content</h2>
        <p>This is inside the glass container.</p>
      </div>
    </otui-glass-container>
  `,
});

export const Primary: Story = {
  render: HtmlTemplate,
};

// (Optional Angular story removed to reduce commented-out example code.)
