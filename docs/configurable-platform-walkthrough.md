# Configurable Platform Walkthrough

This walkthrough exercises the configurable client and Business Site work delivered through slices P9–P14. It describes repeatable product behavior rather than storing browser captures or test logs in the repository.

## Start the development stack

```bash
pnpm run build:dev
pnpm run docker:dev
pnpm run docker:dev:seed
```

Confirm the primary applications respond:

- Configurable Client: `http://127.0.0.1:4200`
- Business Site: `http://127.0.0.1:8094`
- Gateway API: `http://127.0.0.1:3000`

## P9: publish and resolve configuration

1. Sign in as an owner and open a workspace configuration.
2. Edit the application shell or landing-page configuration.
3. Save a draft and confirm the anonymous public route still serves the last published revision.
4. Publish the revision and refresh the public route.
5. Confirm the published configuration resolves by slug/domain and an unknown tenant returns `404`.

Expected behavior: publication is revision-aware, draft changes remain private, and public resolution never falls back to another tenant.

## P10: configurable client shell

1. Open the Configurable Client through a published tenant URL.
2. Confirm navigation and enabled features match the published configuration.
3. Enter the owner editor, change shell or landing content, and preview it.
4. Attempt to leave with unsaved changes and confirm the in-app navigation warning appears.
5. Save, publish, and verify the public shell reflects the new configuration.

Expected behavior: owner authoring, preview, navigation protection, and the public shell share the same configuration contract.

## P11: workspace discovery and access

1. Open the workspace dashboard with an authenticated account.
2. Verify joinable, request-only, and private applications expose the correct actions.
3. Join a joinable application and request access to a request-only application.
4. Confirm private applications remain undiscoverable without membership.
5. Switch between two owners and verify each sees only their own configuration and membership context.

Expected behavior: discovery and mutations are scoped by workspace, application, and authenticated identity.

## P12: responsive Business Site foundation

1. Open the Business Site directory and a seeded tenant at desktop and mobile widths.
2. Verify the primary navigation, hero, services, testimonials, contact form, and booking links remain usable.
3. Confirm there is no horizontal overflow and keyboard focus remains visible.
4. Verify form fields expose stable labels, including the contact subject control.

Expected behavior: the shared public landing components provide responsive structure and accessible controls without tenant-specific layout forks.

## P13: owner and client workflows

1. Register a new owner, finish onboarding, sign out, and sign back in.
2. Create or update services, bookings, routines, and check-ins.
3. Sign in as a client and verify assigned work, sessions, billing, and check-ins.
4. Register a second owner and confirm cross-tenant reads and mutations are rejected.

Expected behavior: owner and client sessions remain distinct, normal dashboard flows work end to end, and tenant isolation survives reauthentication.

## P14: publishing policy and public presentation

1. Open a never-published site in the owner editor.
2. Confirm the editor offers **Save as draft** and **Publish**.
3. Save as draft and verify the anonymous public route does not expose the draft.
4. Publish, edit the site again, and confirm **Save Changes** immediately updates the published site.
5. Sign in as a pending client and confirm the normal dashboard remains available while approval is pending.
6. Navigate from one tenant to another and confirm no prior-tenant or `My Business` fallback content flashes during resolution.
7. Verify hero motion renders behind the headline and calls to action, with no preset explanation or slice labels in the public page body.

Expected behavior: publishing controls reflect lifecycle state, pending clients retain dashboard access, and tenant content is isolated from the first render onward.

## Automated verification

Use the checked-in Nx targets and preserve a running Docker stack:

```bash
CI=true SKIP_SETUP=true BASE_URL=http://127.0.0.1:8094 \
NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
pnpm nx run business-site-e2e:e2e \
  --skipNxCache --outputStyle=stream-without-prefixes
```

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
pnpm nx run configurable-client-e2e:e2e-ci \
  --skipNxCache --outputStyle=stream-without-prefixes
```

Before merging the complete cross-stack change, run:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm run build:dev
git diff --check
```

## Known follow-ups

- Raise the primary Business Site CTA contrast from its WCAG AA level to the product's stricter 7:1 target.
- Resolve font fallback diagnostics, Angular `NG0956` collection recreation warnings, and the missing `energetic` theme diagnostic.
- Preserve the known API note that authentication of an absent user currently returns HTTP `500`.
