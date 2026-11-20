/**
 * Owner-approved profile facts.
 *
 * Owner-approved resume PDF lives in `public/assets`. The templates render the
 * resume link only when a path is set.
 */
export const PROFILE = {
  name: 'Christopher Rutherford',
  headline: 'Full-stack engineer and systems administrator',
  location: 'Georgia and New York',
  b2bAvailability: 'South Georgia and remote',
  links: {
    github: 'https://github.com/cjrutherford',
    linkedin: 'https://www.linkedin.com/in/thecjrutherford',
    /** Approved resume PDF. Renders as a link only when set. */
    resume: '/assets/christopher-rutherford-resume.pdf',
    /** Public contact address. */
    email: 'chris@christopherrutherford.net',
  },
} as const;
