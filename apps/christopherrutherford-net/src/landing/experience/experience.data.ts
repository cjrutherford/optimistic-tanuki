export interface ExperienceEntry {
  organization: string;
  role: string;
  location?: string;
  period: string;
  summary: string;
}

/**
 * Mirrors the owner-approved resume
 * (`public/assets/christopher-rutherford-resume.pdf`). Titles, places and
 * dates come from it; the summaries are short restatements without figures.
 * Update this file whenever the resume changes.
 */
export const EXPERIENCE_INTRO =
  'I started in systems administration and desktop support in New York, then moved into software engineering by building internal tools and database systems. Since then I have worked across backend services, Angular front ends, data pipelines, and Kubernetes delivery.';

export const EXPERIENCE: ExperienceEntry[] = [
  {
    organization: 'Hopeful Aspirations Industries',
    role: 'Independent engineering (founder)',
    period: 'Jun 2025 – Present',
    summary:
      'Building the Optimistic Tanuki platform: Angular front ends, a NestJS gateway, and decoupled NestJS services in an Nx monorepo.',
  },
  {
    organization: 'Blockstream',
    role: 'Software Engineer / Full-Stack Developer',
    location: 'Remote',
    period: 'Jun 2022 – Jun 2025',
    summary:
      'Defined NestJS service boundaries for hardware telemetry ingestion, designed MySQL partitioning, and built API analytics, BigQuery reporting, and billing automation.',
  },
  {
    organization: 'Polymorphic Inc.',
    role: 'Full-Stack Developer & Project Lead',
    location: 'Remote',
    period: 'Aug 2020 – Jun 2022',
    summary:
      'Led design and delivery of a hardware hosting and telemetry platform, and migrated a monolith to Google Cloud and Kubernetes services.',
  },
  {
    organization: 'OnCare',
    role: 'Full-Stack Engineer',
    period: 'Jul 2019 – Jan 2020',
    summary:
      'Served as Angular and RxJS subject matter expert, standardized reactive state patterns, and mentored engineers.',
  },
  {
    organization: 'Lunchbox Technologies',
    role: 'Backend Engineer',
    period: 'May 2019 – Jun 2019',
    summary:
      'Developed Express and Node.js REST APIs with MongoDB and point-of-sale integrations during a backend refactor.',
  },
  {
    organization: 'Dittach',
    role: 'Backend Engineer',
    period: 'Nov 2018 – Feb 2019',
    summary:
      'Extended containerized Node.js microservices and reworked Google OAuth2 and Drive integration for a Chrome extension.',
  },
  {
    organization: 'A.A. General Service Office',
    role: 'Database Coordinator & Internal App Developer',
    period: 'Oct 2016 – Nov 2018',
    summary:
      'Re-engineered SQL Server databases and built internal Node.js and Angular systems, including a record verification portal and a data migration engine.',
  },
  {
    organization: 'Earlier',
    role: 'Systems administration and desktop support',
    location: 'New York',
    period: '2010 – 2017',
    summary:
      'Systems and deskside roles, alongside C# and PowerShell automation utilities.',
  },
];
