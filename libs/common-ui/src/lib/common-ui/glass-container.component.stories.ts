import type { Meta, StoryObj } from '@storybook/angular';
import { GlassContainerComponent } from './glass-container.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { CardComponent } from './card/card.component';
import { importProvidersFrom } from '@angular/core';

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

// const AngularTemplate = (args: Partial<GlassContainerComponent>) => ({
//   props: args,
//   imports: [GlassContainerComponent, CardComponent],
//   template: `
//     <otui-glass-container>
//       <otui-card>
//         <div style="padding: 16px; text-align: center;">
//           <h2>Glass Container Content</h2>
//           <p>This is inside the glass container, wrapped in a card.</p>
//         </div>
//       </otui-card>
//     </otui-glass-container>
//   `,
// });

export const Primary: Story = {
  render: HtmlTemplate,
};

// export const Heading: Story = {
//   render: AngularTemplate,
//   play: async ({ canvasElement }) => {
//     const canvas = within(canvasElement);
//     expect(canvas.getByText(/Glass Container Content/gi)).toBeTruthy();
//   },
// };
