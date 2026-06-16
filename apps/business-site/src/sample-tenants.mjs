const OWNER_PASSWORD = 'BusinessOwnerPass123!';

function createSections({
  businessName,
  heroTitle,
  heroBody,
  aboutTitle,
  aboutBody,
  bookingLabel,
}) {
  return [
    {
      id: 'hero',
      type: 'hero',
      title: 'Welcome',
      enabled: true,
      order: 0,
      richContent: {
        title: heroTitle,
        content: `<p>${heroBody}</p>`,
      },
      ctaLabel: bookingLabel,
      ctaHref: '/book',
    },
    {
      id: 'about',
      type: 'about',
      title: 'About',
      enabled: true,
      order: 1,
      richContent: {
        title: aboutTitle,
        content: `<p>${aboutBody}</p>`,
      },
    },
    {
      id: 'services',
      type: 'services',
      title: 'Services',
      enabled: true,
      order: 2,
      body: `Explore the core services ${businessName} offers.`,
    },
    {
      id: 'testimonials',
      type: 'testimonials',
      title: 'Testimonials',
      enabled: true,
      order: 3,
    },
    {
      id: 'contact',
      type: 'contact',
      title: 'Contact',
      enabled: true,
      order: 4,
      body: `Reach out to ${businessName} for a detailed estimate and scheduling.`,
    },
    {
      id: 'booking',
      type: 'booking',
      title: 'Book Now',
      enabled: true,
      order: 5,
      ctaLabel: bookingLabel,
      ctaHref: '/book',
    },
  ];
}

function createTenantPreset({
  configKey,
  owner,
  site,
  businessType,
  brand,
  contact,
  theme,
  services,
  clientPortal,
  testimonials,
  heroTitle,
  heroBody,
  aboutTitle,
  aboutBody,
}) {
  return {
    configKey,
    owner: {
      ...owner,
      password: OWNER_PASSWORD,
    },
    site,
    businessType,
    brand,
    contact,
    features: {
      booking: { enabled: true, allowOnlinePayment: false },
      clientTasks: { enabled: false, allowClientCompletion: false },
      clientPortal: { enabled: true },
      invoices: { enabled: false },
      testimonials: { enabled: true },
    },
    serviceCatalog: {
      source: 'manual',
    },
    services,
    landingPage: {
      layout: 'single-column',
      sections: createSections({
        businessName: brand.businessName,
        heroTitle,
        heroBody,
        aboutTitle,
        aboutBody,
        bookingLabel: contact.consultationLabel,
      }),
    },
    clientPortal,
    testimonials,
    theme,
  };
}

export const PRIMARY_WORKFLOW_TENANT_SLUG = 'north-star-advisory';

export const DEV_BUSINESS_TENANT_PRESETS = [
  createTenantPreset({
    configKey: 'default',
    owner: {
      email: 'owner@localbusiness.test',
      firstName: 'Jordan',
      lastName: 'Vale',
      bio: 'Owner-operator focused on a polished online presence and a simple client portal for repeat customers.',
      profileName: 'Jordan Vale',
    },
    site: {
      slug: PRIMARY_WORKFLOW_TENANT_SLUG,
      status: 'published',
      onboardingCompletedAt: '2026-06-13T10:00:00.000Z',
    },
    businessType: 'consulting',
    brand: {
      businessName: 'North Star Advisory',
      ownerName: 'Jordan Vale',
      trainerName: 'Jordan Vale',
      monogram: 'NS',
      tagline: 'Operational guidance for growing service businesses.',
      intro:
        'Clear scheduling, better client handoff, and a simpler approval flow.',
      longBio:
        'North Star Advisory helps service businesses turn interest into approved client relationships and well-structured engagements.',
      credentials: ['Operations strategy', 'Client systems'],
      specializations: ['Scheduling', 'Client onboarding'],
    },
    contact: {
      email: 'hello@northstar.local',
      phone: '(555) 410-1100',
      location: 'Remote and on-site sessions by appointment.',
      consultationLabel: 'Book a strategy session',
    },
    theme: {
      mode: 'light',
      personalityId: 'professional',
      primaryColor: '#1f5f8b',
    },
    services: [
      {
        id: 'operations-intensive',
        name: 'Operations intensive',
        description:
          'A focused working session to tighten intake, approvals, and scheduling.',
        duration: 90,
        price: 275,
        allowOnlineBooking: true,
      },
      {
        id: 'client-system-audit',
        name: 'Client system audit',
        description:
          'Review your client lifecycle and identify handoff, staffing, and communication gaps.',
        duration: 120,
        price: 425,
        allowOnlineBooking: true,
      },
    ],
    clientPortal: {
      headline: 'Keep your client work, notes, and next steps organized.',
      description:
        'Approved clients can review scheduled sessions, action items, and follow-up requests in one place.',
      capabilities: [
        'Review appointments and requests',
        'Track action items and next steps',
        'Keep project notes attached to the business relationship',
      ],
    },
    testimonials: [
      {
        quote:
          'We stopped losing requests in text threads and finally had a clear intake path.',
        clientName: 'Avery Cole',
        clientDetail: 'Service business owner',
      },
    ],
    heroTitle: 'Build a cleaner service-business operating rhythm.',
    heroBody:
      'North Star Advisory helps service owners tighten intake, approvals, scheduling, and follow-through.',
    aboutTitle: 'Operations support for service teams',
    aboutBody:
      'This seeded business shows a higher-trust advisory business with booking, approvals, and client follow-up enabled.',
  }),
  createTenantPreset({
    configKey: 'tenant:steady-hand-contracting',
    owner: {
      email: 'owner-handyman@localbusiness.test',
      firstName: 'Luis',
      lastName: 'Moreno',
      bio: 'General contractor running estimate requests, repeat repair clients, and project follow-up from one portal.',
      profileName: 'Luis Moreno',
    },
    site: {
      slug: 'steady-hand-contracting',
      status: 'published',
      onboardingCompletedAt: '2026-06-13T10:00:00.000Z',
    },
    businessType: 'general',
    brand: {
      businessName: 'Steady Hand Contracting',
      ownerName: 'Luis Moreno',
      monogram: 'SH',
      tagline: 'Reliable repairs, remodel support, and punch-list work.',
      intro:
        'From deck repairs to interior finish work, keep small projects moving.',
      longBio:
        'Steady Hand Contracting handles punch lists, repairs, trim work, and small renovations for homeowners who want a dependable local crew.',
      credentials: ['Licensed contractor', 'Insured crews'],
      specializations: ['Repairs', 'Finish carpentry', 'Small remodels'],
    },
    contact: {
      email: 'hello@steadyhand.local',
      phone: '(555) 410-1200',
      location: 'Serving homeowners across the metro area.',
      consultationLabel: 'Request an estimate',
    },
    theme: {
      mode: 'light',
      personalityId: 'grounded',
      primaryColor: '#8c4f28',
    },
    services: [
      {
        id: 'repair-visit',
        name: 'Repair visit',
        description:
          'Half-day repair support for common home fixes and punch-list work.',
        duration: 180,
        price: 325,
        allowOnlineBooking: true,
      },
      {
        id: 'project-walkthrough',
        name: 'Project walkthrough',
        description:
          'On-site estimate and scope review for larger repair or improvement work.',
        duration: 60,
        price: 85,
        allowOnlineBooking: true,
      },
    ],
    clientPortal: {
      headline: 'Track your estimate, schedule, and project notes.',
      description:
        'Clients can keep job details, access updates, and stay aligned on next steps without chasing text messages.',
      capabilities: [
        'Review estimate and job notes',
        'Confirm scheduling details',
        'Keep project communication in one place',
      ],
    },
    testimonials: [
      {
        quote:
          'They handled our repair list quickly and made the scheduling part easy.',
        clientName: 'Megan Holt',
        clientDetail: 'Homeowner',
      },
    ],
    heroTitle: 'Dependable contractor support for the jobs that pile up.',
    heroBody:
      'Use this seeded example to showcase estimate requests, repair scheduling, and homeowner communication.',
    aboutTitle: 'Built for repeat repair and small-project work',
    aboutBody:
      'This setup fits a handyman or general contractor who needs a clean intake flow, not a complex enterprise CRM.',
  }),
  createTenantPreset({
    configKey: 'tenant:clearcrest-pressure-washing',
    owner: {
      email: 'owner-pressure@localbusiness.test',
      firstName: 'Nina',
      lastName: 'Hart',
      bio: 'Outdoor cleaning specialist managing seasonal demand, recurring property clients, and estimate requests.',
      profileName: 'Nina Hart',
    },
    site: {
      slug: 'clearcrest-pressure-washing',
      status: 'published',
      onboardingCompletedAt: '2026-06-13T10:00:00.000Z',
    },
    businessType: 'general',
    brand: {
      businessName: 'Clearcrest Pressure Washing',
      ownerName: 'Nina Hart',
      monogram: 'CP',
      tagline: 'Driveways, siding, patios, and storefront refreshes.',
      intro:
        'Quick quote requests and route-friendly scheduling for exterior cleaning jobs.',
      longBio:
        'Clearcrest Pressure Washing serves homeowners and small commercial properties with seasonal cleanups, curb-appeal refreshes, and routine maintenance visits.',
      credentials: ['Licensed and insured', 'Eco-safe detergents'],
      specializations: [
        'House washing',
        'Concrete cleaning',
        'Storefront refresh',
      ],
    },
    contact: {
      email: 'hello@clearcrest.local',
      phone: '(555) 410-1300',
      location: 'Residential and light commercial routes.',
      consultationLabel: 'Get a wash quote',
    },
    theme: {
      mode: 'light',
      personalityId: 'energetic',
      primaryColor: '#1d79a8',
    },
    services: [
      {
        id: 'driveway-clean',
        name: 'Driveway and walkway clean',
        description:
          'Pressure washing for driveways, sidewalks, and front entry concrete.',
        duration: 120,
        price: 220,
        allowOnlineBooking: true,
      },
      {
        id: 'house-wash',
        name: 'House wash',
        description:
          'Soft-wash treatment for siding, trim, and exterior buildup.',
        duration: 180,
        price: 360,
        allowOnlineBooking: true,
      },
    ],
    clientPortal: {
      headline:
        'Keep quote details, prep notes, and repeat-service timing together.',
      description:
        'This portal supports before-and-after scheduling, prep reminders, and recurring property maintenance.',
      capabilities: [
        'Review prep instructions',
        'Track scheduled cleaning visits',
        'Keep repeat-service timing visible',
      ],
    },
    testimonials: [
      {
        quote:
          'The quote was fast, the prep steps were clear, and the house looked new again.',
        clientName: 'Renee Bishop',
        clientDetail: 'Homeowner',
      },
    ],
    heroTitle: 'Make exterior cleaning easy to request and easy to repeat.',
    heroBody:
      'This preset highlights quick quote conversion for seasonal and repeat exterior cleaning work.',
    aboutTitle: 'A strong fit for route-based outdoor service businesses',
    aboutBody:
      'Pressure washing businesses need fast intake, prep reminders, and lightweight repeat booking support.',
  }),
  createTenantPreset({
    configKey: 'tenant:ovenbird-bakeshop',
    owner: {
      email: 'owner-baker@localbusiness.test',
      firstName: 'Camille',
      lastName: 'Price',
      bio: 'Home baker coordinating order requests, pickup dates, and celebration details for custom baked goods.',
      profileName: 'Camille Price',
    },
    site: {
      slug: 'ovenbird-bakeshop',
      status: 'published',
      onboardingCompletedAt: '2026-06-13T10:00:00.000Z',
    },
    businessType: 'general',
    brand: {
      businessName: 'Ovenbird Bakeshop',
      ownerName: 'Camille Price',
      monogram: 'OB',
      tagline: 'Custom cakes, pastry boxes, and made-to-order bakes.',
      intro:
        'Take custom order requests without losing pickup details or design notes.',
      longBio:
        'Ovenbird Bakeshop handles celebration cakes, pastry boxes, and seasonal menus with a warm ordering experience and a clear pickup workflow.',
      credentials: ['Licensed cottage bakery', 'Custom flavor menus'],
      specializations: [
        'Custom cakes',
        'Holiday boxes',
        'Small-batch pastries',
      ],
    },
    contact: {
      email: 'hello@ovenbird.local',
      phone: '(555) 410-1400',
      location: 'Pickup studio open by scheduled pickup windows.',
      consultationLabel: 'Start an order',
    },
    theme: {
      mode: 'light',
      personalityId: 'warm',
      primaryColor: '#c46a52',
    },
    services: [
      {
        id: 'custom-cake-order',
        name: 'Custom cake order',
        description:
          'Design consultation, flavor selection, and pickup scheduling for celebration cakes.',
        duration: 45,
        price: 125,
        allowOnlineBooking: true,
      },
      {
        id: 'pastry-box-order',
        name: 'Pastry box preorder',
        description:
          'Reserve a mixed pastry box for weekend pickup or gifting.',
        duration: 30,
        price: 48,
        allowOnlineBooking: true,
      },
    ],
    clientPortal: {
      headline: 'Keep custom order details and pickup timing in one thread.',
      description:
        'Clients can confirm event dates, design notes, and pickup windows without back-and-forth confusion.',
      capabilities: [
        'Review order details and pickup date',
        'Keep flavor and design notes attached to the order',
        'See follow-up requests in one place',
      ],
    },
    testimonials: [
      {
        quote:
          'The ordering flow was clear and the cake notes stayed organized from start to finish.',
        clientName: 'Dana Kim',
        clientDetail: 'Birthday cake customer',
      },
    ],
    heroTitle: 'A sweeter custom-order workflow for home bakers.',
    heroBody:
      'This preset shows how a made-to-order bakery can capture event details, custom notes, and pickup timing cleanly.',
    aboutTitle: 'Designed for custom order businesses',
    aboutBody:
      'Bakers need more than a contact form. They need space for flavor notes, event timing, and client follow-up.',
  }),
  createTenantPreset({
    configKey: 'tenant:emberline-studio',
    owner: {
      email: 'owner-artist@localbusiness.test',
      firstName: 'Sloane',
      lastName: 'Mercer',
      bio: 'Independent artist balancing custom commissions, collector updates, and a rotating inventory of ready-to-ship work.',
      profileName: 'Sloane Mercer',
    },
    site: {
      slug: 'emberline-studio',
      status: 'published',
      onboardingCompletedAt: '2026-06-13T10:00:00.000Z',
    },
    businessType: 'general',
    brand: {
      businessName: 'Emberline Studio',
      ownerName: 'Sloane Mercer',
      monogram: 'ES',
      tagline: 'Commissioned portraits and small-batch original artwork.',
      intro:
        'Accept custom portrait commissions while keeping ready-to-ship originals and print drops visible in one storefront.',
      longBio:
        'Emberline Studio is an independent art practice creating commissioned portraits, atmospheric gouache landscapes, and collector-ready print releases with a clear consultation and fulfillment flow.',
      credentials: [
        'Independent illustrator',
        'Commission waitlist management',
      ],
      specializations: [
        'Commissioned portraits',
        'Ready-to-ship originals',
        'Limited print drops',
      ],
    },
    contact: {
      email: 'hello@emberline.local',
      phone: '(555) 410-1600',
      location:
        'Shipping nationwide from a private studio with local pickup by arrangement.',
      consultationLabel: 'Book a commission consult',
    },
    theme: {
      mode: 'dark',
      personalityId: 'confident',
      primaryColor: '#c96a3d',
    },
    services: [
      {
        id: 'portrait-commission-consult',
        name: 'Portrait commission consult',
        description:
          'Planning call for collector goals, size, medium, and turnaround before reserving a portrait slot.',
        duration: 30,
        price: 45,
        allowOnlineBooking: true,
      },
      {
        id: 'custom-pet-portrait-commission',
        name: 'Custom pet portrait commission',
        description:
          'Booked commission slot for a custom pet portrait with concept review and delivery timeline.',
        duration: 60,
        price: 320,
        allowOnlineBooking: true,
      },
    ],
    clientPortal: {
      headline:
        'Keep commission details, approvals, and fulfillment notes attached to the artwork.',
      description:
        'Collectors can review concept notes, timeline updates, and delivery details without losing the thread between consultation and shipment.',
      capabilities: [
        'Review commission notes and references',
        'Track approval steps and completion timing',
        'Keep shipping and pickup details in one place',
      ],
    },
    testimonials: [
      {
        quote:
          'The commission process felt thoughtful from the first consult to the final delivery, and the available pieces made it easy to buy a second work on the spot.',
        clientName: 'Leah Torres',
        clientDetail: 'Portrait and print collector',
      },
    ],
    heroTitle:
      'Commission custom artwork without hiding the pieces already in stock.',
    heroBody:
      'This preset pairs bookable commission work with a store-backed inventory of originals, prints, and merch for independent artists.',
    aboutTitle:
      'Built for artists with both commissions and ready-to-ship work',
    aboutBody:
      'Independent artists often juggle consultation-led commissions and frequent inventory drops. This setup supports both without forcing them into separate systems.',
  }),
  createTenantPreset({
    configKey: 'tenant:canopy-tree-service',
    owner: {
      email: 'owner-tree@localbusiness.test',
      firstName: 'Marcus',
      lastName: 'Dean',
      bio: 'Tree service owner balancing estimates, storm-response calls, and seasonal pruning schedules.',
      profileName: 'Marcus Dean',
    },
    site: {
      slug: 'canopy-tree-service',
      status: 'published',
      onboardingCompletedAt: '2026-06-13T10:00:00.000Z',
    },
    businessType: 'general',
    brand: {
      businessName: 'Canopy Tree Service',
      ownerName: 'Marcus Dean',
      monogram: 'CT',
      tagline: 'Tree removal, pruning, storm cleanup, and arbor care.',
      intro:
        'Manage urgent requests, estimates, and follow-up communication from one hosted site.',
      longBio:
        'Canopy Tree Service supports homeowners and property managers with tree assessments, removals, trimming, and storm cleanup response.',
      credentials: ['ISA-informed crews', 'Fully insured'],
      specializations: ['Pruning', 'Removals', 'Storm cleanup'],
    },
    contact: {
      email: 'hello@canopy.local',
      phone: '(555) 410-1500',
      location: 'Serving residential and light commercial properties.',
      consultationLabel: 'Request a site visit',
    },
    theme: {
      mode: 'light',
      personalityId: 'assertive',
      primaryColor: '#2f6b3a',
    },
    services: [
      {
        id: 'tree-assessment',
        name: 'Tree assessment',
        description:
          'On-site safety and health assessment with next-step recommendations.',
        duration: 60,
        price: 95,
        allowOnlineBooking: true,
      },
      {
        id: 'storm-cleanup-quote',
        name: 'Storm cleanup quote',
        description:
          'Rapid visit for limb damage, debris cleanup, and urgent hazard planning.',
        duration: 45,
        price: 0,
        allowOnlineBooking: true,
      },
    ],
    clientPortal: {
      headline: 'Centralize estimate notes, safety details, and scheduling.',
      description:
        'Tree work often starts with a site visit and a lot of context. The portal keeps those details attached to the client record.',
      capabilities: [
        'Review site-visit details',
        'Track estimate follow-up',
        'Keep scheduling and safety notes together',
      ],
    },
    testimonials: [
      {
        quote:
          'They handled the storm damage fast and the follow-up estimate process was straightforward.',
        clientName: 'Paul Garner',
        clientDetail: 'Property manager',
      },
    ],
    heroTitle: 'A better intake flow for estimates, hazards, and cleanup work.',
    heroBody:
      'This preset fits tree services that need fast request capture and clear site-visit follow-up.',
    aboutTitle: 'Good for estimate-heavy outdoor crews',
    aboutBody:
      'Tree work mixes urgent requests with scheduled care, so the site needs to support both fast contact and organized follow-up.',
  }),
  createTenantPreset({
    configKey: 'tenant:ledgerline-accounting',
    owner: {
      email: 'owner-accountant@localbusiness.test',
      firstName: 'Priya',
      lastName: 'Kapoor',
      bio: 'CPA-focus accountant offering bookkeeping cleanup, quarterly tax planning, and payroll review for small-business owners.',
      profileName: 'Priya Kapoor',
    },
    site: {
      slug: 'ledgerline-accounting',
      status: 'published',
      onboardingCompletedAt: '2026-06-13T10:00:00.000Z',
    },
    businessType: 'accounting',
    brand: {
      businessName: 'Ledgerline Accounting',
      ownerName: 'Priya Kapoor',
      monogram: 'LA',
      tagline: 'Bookkeeping cleanup, tax planning, and payroll review.',
      intro: 'Keep financials clean, deadlines visible, and payroll accurate.',
      longBio:
        'Ledgerline Accounting helps small-business owners reconcile books, stay current on tax obligations, and keep payroll running without guesswork.',
      credentials: ['Certified Public Accountant', 'QuickBooks ProAdvisor'],
      specializations: [
        'Bookkeeping cleanup',
        'Tax planning',
        'Payroll review',
        'Advisory',
      ],
    },
    contact: {
      email: 'hello@ledgerline.local',
      phone: '(555) 410-1700',
      location: 'Remote-first advisory services.',
      consultationLabel: 'Book a bookkeeping review',
    },
    theme: {
      mode: 'light',
      personalityId: 'professional',
      primaryColor: '#1f5f8b',
    },
    services: [
      {
        id: 'bookkeeping-cleanup',
        name: 'Bookkeeping cleanup',
        description:
          'Catch-up and reconciliation session to turn messy books into a clean ledger ready for tax time.',
        duration: 90,
        price: 275,
        allowOnlineBooking: true,
      },
      {
        id: 'quarterly-tax-planning',
        name: 'Quarterly tax planning',
        description:
          'Proactive review of estimated payments, deductions, and entity-level planning ahead of each quarter.',
        duration: 60,
        price: 175,
        allowOnlineBooking: true,
      },
      {
        id: 'payroll-review',
        name: 'Payroll review',
        description:
          'Audit of payroll runs, tax withholdings, and contractor classifications to reduce exposure.',
        duration: 45,
        price: 125,
        allowOnlineBooking: true,
      },
    ],
    clientPortal: {
      headline:
        'Track document deadlines, payroll windows, and advisory checklists.',
      description:
        'Clients can upload statements, review upcoming filing deadlines, and follow a checklist for each month-end close.',
      capabilities: [
        'Review upcoming tax and payroll deadlines',
        'Upload supporting documents and receipts',
        'Track month-end close checklist items',
      ],
    },
    testimonials: [
      {
        quote:
          'We finally stopped scrambling at quarter close because the ledger was already current.',
        clientName: 'Dana Ruiz',
        clientDetail: 'Retail business owner',
      },
    ],
    heroTitle: 'Keep financials clean and tax seasons predictable.',
    heroBody:
      'Ledgerline Accounting brings the clarity of a dedicated small-business accounting practice into a hosted, review-ready portal.',
    aboutTitle: 'Built for small businesses that need reliable bookkeeping',
    aboutBody:
      'This seeded business pairs clean intake forms with a checklist-driven portal so owners stay on top of books, deadlines, and payroll.',
  }),
];

const emberlineStudioPreset = DEV_BUSINESS_TENANT_PRESETS.find(
  (preset) => preset.site.slug === 'emberline-studio'
);

if (emberlineStudioPreset) {
  emberlineStudioPreset.features.store = {
    enabled: true,
  };
  emberlineStudioPreset.serviceCatalog = {
    source: 'store',
  };
  emberlineStudioPreset.landingPage.sections = [
    {
      id: 'hero',
      type: 'hero',
      title: 'Welcome',
      enabled: true,
      order: 0,
      richContent: {
        title: 'Commission custom artwork and shop the current release.',
        content:
          '<p>Emberline Studio keeps collector-ready originals, prints, and merch visible while still offering commission consults for custom portrait work.</p>',
      },
      ctaLabel: 'Shop current work',
      ctaHref: '#storefront',
    },
    {
      id: 'about',
      type: 'about',
      title: 'About',
      enabled: true,
      order: 1,
      richContent: {
        title: 'Built for artists balancing commissions and ready-to-ship work',
        content:
          '<p>Independent artists need a storefront for in-stock pieces without losing the relationship-driven workflow that custom commissions require.</p>',
      },
    },
    {
      id: 'storefront',
      type: 'store',
      title: 'Shop the current release',
      enabled: true,
      order: 2,
      body: 'Browse available originals, print sets, and small-batch studio merch.',
      ctaLabel: 'Book a commission consult',
      ctaHref: '/book',
    },
    {
      id: 'services',
      type: 'services',
      title: 'Commission Services',
      enabled: true,
      order: 3,
      body: 'Start with a consult, then move into the right commission scope.',
    },
    {
      id: 'testimonials',
      type: 'testimonials',
      title: 'Collector Notes',
      enabled: true,
      order: 4,
    },
    {
      id: 'contact',
      type: 'contact',
      title: 'Contact',
      enabled: true,
      order: 5,
      body: 'Reach out about commission timing, collector questions, or pickup arrangements.',
    },
    {
      id: 'booking',
      type: 'booking',
      title: 'Commission Consults',
      enabled: true,
      order: 6,
      ctaLabel: 'Book a commission consult',
      ctaHref: '/book',
    },
  ];
}

export const WORKFLOW_CLIENT_USERS = [
  {
    email: 'client@localbusiness.test',
    firstName: 'Maya',
    lastName: 'Rivers',
    password: 'ClientPass123!',
    bio: 'Returning client using the portal to review services, updates, and business information.',
    profileName: 'Maya Rivers',
  },
  {
    email: 'pending-client@localbusiness.test',
    firstName: 'Taylor',
    lastName: 'Quinn',
    password: 'PendingClientPass123!',
    bio: 'Prospective client waiting for business approval before booking.',
    profileName: 'Taylor Quinn',
  },
];
