import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';

export const demoAppConfig: Partial<AppConfigurationEntity> = {
  name: 'Demo Application',
  description: 'A demonstration application showcasing all features',
  active: true,
  landingPage: {
    layout: 'single-column',
    sections: [
      {
        id: 'hero-1',
        type: 'hero',
        order: 0,
        visible: true,
        title: 'Welcome to Our Platform',
        subtitle: 'Build amazing things with our powerful tools',
        ctaText: 'Get Started',
        ctaLink: '/signup',
      },
      {
        id: 'features-1',
        type: 'features',
        order: 1,
        visible: true,
        title: 'Powerful Features',
        features: [
          {
            title: 'Social Networking',
            description: 'Connect with others and share posts',
            icon: 'people',
          },
          {
            title: 'Task Management',
            description: 'Organize your work efficiently',
            icon: 'task_alt',
          },
        ],
      },
      {
        id: 'cta-1',
        type: 'cta',
        order: 2,
        visible: true,
        title: 'Ready to Get Started?',
        description: 'Join our platform today',
        buttonText: 'Start Free Trial',
        buttonLink: '/signup',
      },
    ],
  },
  routes: [],
  features: {
    social: { enabled: true },
    tasks: { enabled: true },
  },
  theme: {
    primaryColor: '#007bff',
    secondaryColor: '#6c757d',
    backgroundColor: '#ffffff',
    textColor: '#212529',
    fontFamily: 'Arial, sans-serif',
  },
};
