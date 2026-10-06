# Information Architecture

## Page model (D011)

The homepage is an easy-to-read overview: one headline, one sentence, and a
link per offering. Every business offering gets its own route carrying the
detail. Today all of that detail lives in homepage sections (see
`01-CURRENT-STATE.md`); it moves to the routes below.

## Target route structure

```text
/                          overview: headline per offering → deeper page
├── private-cloud/
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
on-prem mini-servers) has no route yet. It overlaps private cloud; S002 must
confirm with the owner whether it folds into `/private-cloud` or gets its own
page. The ecosystem (app directory) section stays on the homepage.

## Navigation

Preferred structure if the current navigation can support a dropdown:

```text
Home
Solutions
  Private Cloud
  Turn-key Appliances
  Software Stacks
  Custom Software
Cost Comparison
How We Work
Contact
```

If the existing site does not use dropdown navigation, preserve its interaction pattern and fit the new private-cloud route cleanly into that system.

## Cross-linking rules

- Homepage links to every offering route
- Homepage links to `/private-cloud`
- `/private-cloud` links to Home, Organizations, and Open Source Stack pages
- Turn-key Appliances links to private-cloud appliance capability
- Software Stacks links to `/private-cloud/open-source-stack`
- Cost Comparison links to `/private-cloud`
- All private-cloud pages link to `/private-cloud/assessment`
