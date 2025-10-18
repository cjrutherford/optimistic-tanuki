import { Meta, StoryObj } from '@storybook/angular';
import { ContentSectionComponent } from './content-section.component';

const meta: Meta<ContentSectionComponent> = {
  component: ContentSectionComponent,
  title: 'Layout/ContentSection',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<ContentSectionComponent>;

export const Default: Story = {
  args: {
    maxWidth: '1200px',
    padding: '2rem',
  },
  render: (args) => ({
    props: args,
    template: `
      <otui-content-section 
        [maxWidth]="maxWidth"
        [padding]="padding">
        <h2>About Our Platform</h2>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
        <h3>Key Features</h3>
        <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
      </otui-content-section>
    `,
  }),
};

export const NarrowWidth: Story = {
  args: {
    maxWidth: '800px',
    padding: '2rem',
  },
  render: (args) => ({
    props: args,
    template: `
      <otui-content-section 
        [maxWidth]="maxWidth"
        [padding]="padding">
        <h2>Focused Content</h2>
        <p>This section has a narrower max width for better readability.</p>
        <p>Perfect for blog posts and articles.</p>
      </otui-content-section>
    `,
  }),
};

export const WithBackgroundColor: Story = {
  args: {
    maxWidth: '1200px',
    padding: '3rem',
    backgroundColor: '#f5f5f5',
  },
  render: (args) => ({
    props: args,
    template: `
      <otui-content-section 
        [maxWidth]="maxWidth"
        [padding]="padding"
        [backgroundColor]="backgroundColor">
        <h2>Highlighted Section</h2>
        <p>This section has a background color to stand out from the rest of the page.</p>
        <p>Great for call-to-action sections or important information.</p>
      </otui-content-section>
    `,
  }),
};

export const CompactPadding: Story = {
  args: {
    maxWidth: '1200px',
    padding: '1rem',
  },
  render: (args) => ({
    props: args,
    template: `
      <otui-content-section 
        [maxWidth]="maxWidth"
        [padding]="padding">
        <h2>Compact Layout</h2>
        <p>This section uses less padding for a more compact appearance.</p>
      </otui-content-section>
    `,
  }),
};

export const SpacedContent: Story = {
  args: {
    maxWidth: '1200px',
    padding: '4rem',
  },
  render: (args) => ({
    props: args,
    template: `
      <otui-content-section 
        [maxWidth]="maxWidth"
        [padding]="padding">
        <h2>Spacious Layout</h2>
        <p>This section uses more padding for a spacious, breathable layout.</p>
        <p>Ideal for premium content or landing pages.</p>
      </otui-content-section>
    `,
  }),
};
