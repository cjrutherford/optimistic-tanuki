import { Component } from '@angular/core';

type PortalSection = {
  eyebrow: string;
  title: string;
  summary: string;
  bullets: string[];
};

type MetricCard = {
  label: string;
  value: string;
  note: string;
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly metrics: MetricCard[] = [
    {
      label: 'API docs',
      value: 'OpenAPI-ready',
      note: 'Use the live gateway spec as the source of truth for endpoint review and onboarding.',
    },
    {
      label: 'Usage visibility',
      value: 'MVP dashboard',
      note: 'Show the first dashboard surface for key activity, quota posture, and top integration paths.',
    },
    {
      label: 'SDK onboarding',
      value: '3 steps',
      note: 'Install the billing SDK, create a key, and start from the same routes exposed in the platform gateway.',
    },
  ];

  protected readonly sections: PortalSection[] = [
    {
      eyebrow: 'API docs',
      title: 'Browse the current gateway surface',
      summary:
        'Keep the developer portal aligned with the platform by linking directly to the generated API documentation and the metered usage roadmap.',
      bullets: [
        'Open the current Swagger surface without leaving the portal.',
        'Trace metered usage and billing plans back to the roadmap that defines the service model.',
        'Give prospects one place to evaluate the shape of the API before deeper integration work.',
      ],
    },
    {
      eyebrow: 'Usage dashboard',
      title: 'Start with a credibility-first dashboard shell',
      summary:
        'The dashboard is intentionally simple today: it shows the usage, quota, and integration views that future live telemetry will fill.',
      bullets: [
        'Daily request activity card for key-level monitoring.',
        'Quota posture card for plan thresholds and upgrade readiness.',
        'Top integrations list for spotting which product surfaces are active first.',
      ],
    },
    {
      eyebrow: 'SDK getting started',
      title: 'Give developers a short path to first request',
      summary:
        'Pair the public npm surface with the API key and usage model so external developers can move from evaluation to a working integration quickly.',
      bullets: [
        'Install `@optimistic-tanuki/billing-sdk` from npm.',
        'Create a key and target the shared gateway routes.',
        'Use the same plan and usage concepts that the billing roadmap already documents.',
      ],
    },
  ];

  protected readonly integrationSteps = [
    'Read the API surface in the live docs.',
    'Create and store an API key for your integration.',
    'Install the billing SDK and make the first authenticated request.',
  ];

  protected readonly proofPoints = [
    'Signal Foundry runs on the same monorepo, shared gateway, and Nx delivery workflow offered to external developers.',
    'The campaign workbench proves the stack can support structured workflows, export-heavy UI, and iterative product delivery in a real app.',
    'The same platform surface supports public apps, internal tools, and publishable SDKs without splitting the delivery model.',
  ];
}
