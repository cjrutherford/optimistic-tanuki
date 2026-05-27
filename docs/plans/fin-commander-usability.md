# Fin Commander Usability & Flow Improvements

## Overview

This document outlines the plan to improve the usability and flow of the Fin Commander application, particularly for new users.

## Current Issues Identified

1. **Visual**: Finance workspace heading text takes up too much vertical space and is too wordy
2. **Navigation**: The "Personal", "Business", and "Net Worth" tabs (`.switcher-link`) are superfluous - they don't meaningfully switch data
3. **Terminology**: "Tenant" terminology is confusing; should be "Account" (accountant-to-client relationship)
4. **Onboarding**: No holistic onboarding flow; user is thrown into app without setup walkthrough
5. **Workflow**: No clear path from setup → data entry → planning; missing tutorial/help features

## Architecture Understanding

### Current Model

- **Profile** - Personal user identity
- **Tenant** - Currently called "tenant", should be "Account" (client/entity)
- **Workspace** - Personal/Business/Net Worth ledgers within an account
- **Financial Accounts** - Bank accounts, credit cards (actual money accounts)
- **Plan** - Commander planning unit

### Target Model

- **User** = The Accountant (single per user)
- **Account** = The Client/Entity (multiple per user supported)
  - Type: Individual, Business, Non-profit, Household
  - Goals: Per-account goals
  - Workspaces: Personal/Business within the account
  - Plans: Commander plans for that account

---

## Implementation Plan

### Phase 1: Visual & Terminology Fixes

- [x] **1.1** Simplify Finance Shell hero heading (make concise)
- [x] **1.2** Rename "Tenant" → "Account" in UI (keep internal TenantContextService)
- [x] **1.3** Fix/remove non-functional workspace switcher tabs

### Phase 2: Account/Client Architecture (Display only - internal naming unchanged)

- [x] **2.1** Update remaining UI labels from "Tenant" to "Account"
- [x] **2.2** Add Account type display options (Individual, Business, Non-profit, Household)
- [x] **2.3** Update account-switcher to show Account type

### Phase 3: Unified Onboarding Flow

- [x] **3.1** Profile creation step (existing /settings flow)
- [x] **3.2** Account creation step (integrated into OnboardingComponent)
- [x] **3.3** Workspaces selection (integrated into OnboardingComponent)
- [x] **3.4** Financial Accounts setup (existing finance setup checklist)
- [x] **3.5** First Plan creation in Commander (integrated into OnboardingComponent)

### Phase 4: Commander Integration

- [x] **4.1** Plans scoped to Account (savePlan method added)
- [x] **4.2** Guard blocking Commander until onboarding complete (created, not wired)
- [x] **4.3** First Plan wizard in Commander

### Phase 5: Help Features

- [x] **5.1** Floating help button (persistent)
- [x] **5.2** Contextual empty states with clear CTAs
- [ ] **5.3** Tooltip/guided tours for navigation

---

## Changelog

### Phase 5 Complete (2026-04-15)

- Added floating help button (?) in title-bar controls
- Created help panel overlay with Getting Started, Navigation, and Quick Actions sections
- Added contextual empty states to Overview page:
  - Workspaces without accounts show "Add your first account" CTA
  - Empty goals section shows "Create your first goal" CTA
  - Empty scenarios section shows "Create your first scenario" CTA

### Phase 4 Complete (2026-04-15)

- Added `savePlan()` method to FinCommanderPlanStore for creating new plans
- Created `onboarding-complete.guard.ts` to protect Commander routes
- Created `OnboardingComponent` with 3-step wizard:
  - Step 1: Create Account (name + type selection)
  - Step 2: Choose Workspaces (Personal/Business)
  - Step 3: Create First Plan
- Updated login flow to check for existing account and redirect to onboarding if needed

### Phase 2 Complete (2026-04-15)

- Added FinanceAccountType type to finance-ui models (individual, business, nonprofit, household)
- Updated "Loading tenant" to "Loading account" in title-bar component
- Updated "Active tenant" label to "Active account" in title-bar HTML
- Updated tenant-switcher to show account type badge in dropdown options

### Phase 1 Complete (2026-04-15)

- Simplified Finance Shell hero heading from verbose text to just the shell title
- Condensed the lede paragraph to a shorter, cleaner description
- Renamed "Tenant" label to "Account" in the tenant-switcher component
- Made workspace switcher conditional - only renders when there are 2+ workspaces enabled
