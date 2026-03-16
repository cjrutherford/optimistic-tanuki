# Local Hub Commerce: Donations, Business Pages, and Sponsorships

This document outlines the commercial and community support features available in the Local Hub application.

## 1. Community Donations & Goals

### Overview
Every city and community has an associated donation goal to power local events, outreach, and improvement initiatives.

### Features
- **Visual Progress:** A `DonationProgressComponent` displays the current month's goal vs. actual contributions.
- **One-time & Recurring:** Users can choose to support their community with a single payment or a monthly subscription.
- **Integration:** Powered by the `PaymentService` and the `apps/payments` microservice, with secure checkout via Lemon Squeezy.

---

## 2. Business Outreach Pages

### Overview
Local businesses can create professional profiles within specific communities to reach nearby customers.

### Tiers
- **Basic:** A free listing with essential contact information.
- **Pro ($29/mo):** Featured placement in search results and an analytics dashboard.
- **Enterprise ($99/mo):** Custom branding, multi-location support, and API access.

### Management
- **Creation:** Initiated from the City or Community pages.
- **Ownership:** Owners can edit their business profile details (name, website, description, contact info) directly from the Community page via a dedicated modal.
- **Visibility:** Business listings are displayed on the City page to encourage local discovery.

---

## 3. Community Sponsorships

### Overview
Businesses and individuals can sponsor a community to increase their visibility while contributing to the community's funding goal.

### Sponsorship Types
- **Banner:** Large visual placement at the top of the community feed.
- **Sticky Ad:** A persistent post at the top of the discussion list.
- **Featured:** Highlighted mention in community newsletters or headers.

---

## 4. Implementation Details

### Backend
- **Payments Microservice:** Manages the lifecycle of transactions, subscriptions, and payouts.
- **Entity Models:** 
  - `Donation`: Tracks individual contributions.
  - `BusinessPage`: Stores business profile data and subscription status.
  - `CommunitySponsorship`: Manages active ad placements and expiry.

### Frontend
- **PaymentService:** Centralized Angular service for interacting with the payments API.
- **Components:**
  - `DonationProgressComponent`: Shared visualization tool.
  - `SponsorshipBannerComponent`: Renders active sponsorships based on community ID.
  - `ModalComponent`: Used for business profile editing and sponsorship configuration.
