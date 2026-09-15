import type { Meta, StoryObj } from '@storybook/angular';
import { LandingHeroComponent } from './landing-hero.component';

const meta: Meta<LandingHeroComponent> = {
  component: LandingHeroComponent,
  title: 'Landing Hero',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    eyebrow: 'Learn by running it',
    headline: 'Courses where every exercise compiles.',
    subhead: 'Read a lesson, change the code, see what happens.',
    reassurance: 'The first lesson of every course is free, no account needed.',
    sampleLesson: {
      courseName: "Let's Go",
      lessonTitle: 'Your first goroutine',
      excerpt:
        'A goroutine is a function that runs alongside the rest of your program.',
      exerciseTitle: 'Fan out three fetches',
    },
  },
  argTypes: { browse: { action: 'browse' }, write: { action: 'write' } },
};

export default meta;
type Story = StoryObj<LandingHeroComponent>;

export const WithSampleLesson: Story = {};
export const WithoutSampleLesson: Story = { args: { sampleLesson: null } };
