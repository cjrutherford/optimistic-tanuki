/**
 * Owner-approved profile facts.
 *
 * Owner-approved resume PDF lives in `public/assets`. The templates render the
 * resume link only when a path is set.
 */
export const PROFILE = {
  name: 'Christopher Rutherford',
  role: 'Full-Stack & Systems Engineer',
  headline: 'Full-stack and systems engineer',
  location: 'Based in Georgia',
  relocation: 'Open to relocation to New York City',
  workModes: 'Remote, hybrid, or on-site',
  availability:
    'Based in Georgia · Open to relocation to New York City · Remote, hybrid, or on-site',
  availabilityNote: 'Available for full-time roles and conventional contracts',
  b2bAvailability: 'South Georgia and remote',
  links: {
    github: 'https://github.com/cjrutherford',
    linkedin: 'https://www.linkedin.com/in/thecjrutherford',
    /** Approved resume PDF. Renders as a link only when set. */
    resume: '/assets/christopher-rutherford-resume.pdf',
    /** Public contact address. */
    email: 'chris@christopherrutherford.net',
    /** Independent engineering company. */
    company: 'https://hopefulaspirationsindustries.com',
  },
} as const;
