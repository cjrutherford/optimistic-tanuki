import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import type {
  CTASection,
  ContentSection,
  FeaturesSection,
  FooterSection,
  GridSection,
  HeroSection,
} from '@optimistic-tanuki/app-config-models';
import { ContentSectionComponent } from './content-section.component';
import { CtaSectionComponent } from './cta-section.component';
import { FeaturesSectionComponent } from './features-section.component';
import { FooterSectionComponent } from './footer-section.component';
import { GridSectionComponent } from './grid-section.component';
import { HeroSectionComponent } from './hero-section.component';

const base = { order: 0, visible: true };

const hero: HeroSection = {
  ...base,
  id: 'hero',
  type: 'hero',
  title: 'Riverside Bike Works',
  subtitle:
    'Repairs, tune-ups, and refurbished bikes for commuters and weekend riders.',
  ctaText: 'Book a tune-up',
  ctaLink: '#book',
};

const features: FeaturesSection = {
  ...base,
  id: 'features',
  type: 'features',
  title: 'Why riders come back',
  features: [
    {
      icon: '🔧',
      title: 'Same-day repairs',
      description: 'Most fixes are done while you wait.',
    },
    {
      icon: '♻️',
      title: 'Refurbished stock',
      description: 'Every used bike is rebuilt and road-tested.',
    },
    {
      icon: '📍',
      title: 'Two locations',
      description: 'Savannah and Tybee Island.',
    },
  ],
};

const content: ContentSection = {
  ...base,
  id: 'content',
  type: 'content',
  title: 'Our story',
  content:
    'We started fixing bikes out of a garage in 2014. Ten years later we still answer the phone ourselves.',
  imageUrl: 'https://placehold.co/640x400/334155/e2e8f0?text=Workshop',
  imagePosition: 'right',
};

const grid: GridSection = {
  ...base,
  id: 'grid',
  type: 'grid',
  title: 'Services',
  columns: 3,
  items: [
    { title: 'Tune-up', description: 'Brakes, gears, and a safety check.' },
    { title: 'Wheel build', description: 'Hand-built and trued.' },
    {
      title: 'Fitting',
      description: 'Saddle, reach, and bar height set to you.',
    },
  ],
};

const cta: CTASection = {
  ...base,
  id: 'cta',
  type: 'cta',
  title: 'Ready to ride?',
  description: 'Bring your bike in or book a slot online.',
  buttonText: 'Book now',
  buttonLink: '#book',
};

const footer: FooterSection = {
  ...base,
  id: 'footer',
  type: 'footer',
  content: '© 2026 Riverside Bike Works',
  links: [
    { text: 'Contact', url: '#contact' },
    { text: 'Privacy', url: '#privacy' },
  ],
};

const meta: Meta = {
  title: 'Sections',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    moduleMetadata({
      imports: [
        HeroSectionComponent,
        FeaturesSectionComponent,
        ContentSectionComponent,
        GridSectionComponent,
        CtaSectionComponent,
        FooterSectionComponent,
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj;

export const Hero: Story = {
  render: () => ({
    props: { hero },
    template: `<app-hero-section [section]="hero" />`,
  }),
};
export const Features: Story = {
  render: () => ({
    props: { features },
    template: `<app-features-section [section]="features" />`,
  }),
};
export const Content: Story = {
  render: () => ({
    props: { content },
    template: `<app-content-section [section]="content" />`,
  }),
};
export const Grid: Story = {
  render: () => ({
    props: { grid },
    template: `<app-grid-section [section]="grid" />`,
  }),
};
export const CallToAction: Story = {
  render: () => ({
    props: { cta },
    template: `<app-cta-section [section]="cta" />`,
  }),
};
export const Footer: Story = {
  render: () => ({
    props: { footer },
    template: `<app-footer-section [section]="footer" />`,
  }),
};

export const LandingPage: Story = {
  render: () => ({
    props: { hero, features, content, grid, cta, footer },
    template: `
      <app-hero-section [section]="hero" />
      <app-features-section [section]="features" />
      <app-content-section [section]="content" />
      <app-grid-section [section]="grid" />
      <app-cta-section [section]="cta" />
      <app-footer-section [section]="footer" />`,
  }),
};
