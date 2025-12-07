import { Meta, StoryObj } from '@storybook/angular';
import { HeroSectionComponent } from './hero-section.component';

const meta: Meta<HeroSectionComponent> = {
  component: HeroSectionComponent,
  title: 'Layout/HeroSection',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<HeroSectionComponent>;

export const Default: Story = {
  args: {
    minHeight: '60vh',
    centerContent: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <otui-hero-section 
        [minHeight]="minHeight"
        [centerContent]="centerContent">
        <h1>Welcome to Our Platform</h1>
        <p>Build amazing things with our tools</p>
      </otui-hero-section>
    `,
  }),
};

export const WithBackgroundImage: Story = {
  args: {
    minHeight: '80vh',
    centerContent: true,
    backgroundImage: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200',
    overlayOpacity: 0.5,
  },
  render: (args) => ({
    props: args,
    template: `
      <otui-hero-section 
        [minHeight]="minHeight"
        [centerContent]="centerContent"
        [backgroundImage]="backgroundImage"
        [overlayOpacity]="overlayOpacity">
        <h1>Stunning Visuals</h1>
        <p>Create beautiful experiences</p>
      </otui-hero-section>
    `,
  }),
};

export const WithBackgroundColor: Story = {
  args: {
    minHeight: '50vh',
    centerContent: true,
    backgroundColor: '#3f51b5',
  },
  render: (args) => ({
    props: args,
    template: `
      <otui-hero-section 
        [minHeight]="minHeight"
        [centerContent]="centerContent"
        [backgroundColor]="backgroundColor">
        <h1 style="color: white;">Colored Background</h1>
        <p style="color: white;">Simple and elegant</p>
      </otui-hero-section>
    `,
  }),
};

export const LightOverlay: Story = {
  args: {
    minHeight: '70vh',
    centerContent: true,
    backgroundImage: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200',
    overlayOpacity: 0.2,
    overlayColor: '#ffffff',
  },
  render: (args) => ({
    props: args,
    template: `
      <otui-hero-section 
        [minHeight]="minHeight"
        [centerContent]="centerContent"
        [backgroundImage]="backgroundImage"
        [overlayOpacity]="overlayOpacity"
        [overlayColor]="overlayColor">
        <h1 style="color: #212121;">Light Overlay</h1>
        <p style="color: #424242;">Perfect for light backgrounds</p>
      </otui-hero-section>
    `,
  }),
};
