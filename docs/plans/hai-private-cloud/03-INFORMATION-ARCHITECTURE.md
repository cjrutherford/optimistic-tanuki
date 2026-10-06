# Information Architecture

## Page model (D011)

The homepage is an easy-to-read overview: one headline, one sentence, and a
link per offering. Every business offering gets its own route carrying the
detail. Today all of that detail lives in homepage sections (see
`01-CURRENT-STATE.md`); it moves to the routes below.

## Target route structure

```text
/                          overview: headline per offering → deeper page
├── private-cloud/         ← independent-infrastructure section (D014)
│   ├── home/
│   ├── organizations/
│   ├── open-source-stack/
│   └── assessment/
├── turn-key-appliances/   ← hardware-catalog section
├── software-stacks/       ← solutions-matrix section
├── cost-comparison/       ← ROI calculator section
├── custom-software/       ← services section (portals, tailored software)
├── partners/              ← partner section (white-label delivery)
├── how-we-work/           ← manifesto + engagement sections
└── contact/               ← contact section
```

The independent-infrastructure section (`personal-cloud-section`, VPS and
on-prem mini-servers) folds into `/private-cloud` (D014). The ecosystem (app
directory) section stays on the homepage.

## Navigation

The full tree lives in the `navigation-ui` drawer (`otui-nav-sidebar`),
reachable from a menu button at every width (D015):

```text
Home
Solutions
  Private Cloud
    Home private cloud
    Organizations
    Open-source stack
    Assessment
  Turn-key Appliances
  Software Stacks
  Custom Software
  Partners
Cost Comparison
How We Work
Contact
```

The desktop header keeps a few direct links beside the menu button.

## Cross-linking rules

- Homepage links to every offering route
- Homepage links to `/private-cloud`
- `/private-cloud` links to Home, Organizations, and Open Source Stack pages
- Turn-key Appliances links to private-cloud appliance capability
- Software Stacks links to `/private-cloud/open-source-stack`
- Cost Comparison links to `/private-cloud`
- All private-cloud pages link to `/private-cloud/assessment`
