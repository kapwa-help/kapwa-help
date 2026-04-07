# MVP Roadmap — Kapwa Help

**Date:** 2026-04-07
**Target:** End of April 2026
**Goal:** Shippable MVP for real Philippines disaster relief coordinators

## Scope Decision

Narrowed from multi-tenant SaaS to single-deployment MVP. Multi-tenancy (isolated DBs per tenant, self-service onboarding, kapwahelp.org as a platform) is the long-term vision, but validating core functionality with real users comes first. Generalization happens after proven utility.

## What's In

### 1. Auth + Roles (Supabase Auth, email/password)

- **Admin** — full access: create/close events, manage reference data (orgs, barangays, categories), plus everything coordinators can do
- **Coordinator** — operational role: submit needs, verify/triage submissions, record donations/purchases/deployments, view map + dashboard
- **Anonymous** — view everything (map, transparency dashboard), submit needs + hazards (low barrier for field reporting in a disaster)
- Role stored in Supabase Auth `user_metadata.role` (`admin` | `coordinator`), checked via `auth.jwt()` in RLS policies
- Accounts created manually for first deployment — no self-registration yet

### 2. Data Model Lockdown

- Validate current schema against real Philippines disaster ops with on-the-ground contacts
- Scope narrowly to Philippines (barangays, PHP currency, local aid categories)
- Ensure categories, orgs, and barangays reflect reality for the target deployment area

### 3. Photo Uploads

- Wire existing photo UI (hazard reports) to Supabase Storage
- Extend to need submissions if useful

### 4. Seed Real Data

- Manually configure barangays, organizations, and aid categories for the first partner org
- No self-service configuration UI in MVP

## What's Not In (Future Milestones)

- Multi-tenancy (isolated DBs per tenant on kapwahelp.org)
- Self-service onboarding / admin config UI
- Stories / community features
- SMS/OTP login
- Custom category creation UI
- Paid tier / billing

## Key Decisions + Rationale

| Decision | Why |
|----------|-----|
| Centralized platform over self-hosted template | Disaster relief orgs won't set up their own Postgres/Vercel. 15-min signup beats deploy-it-yourself. |
| Isolated DBs per tenant (future) over shared DB | Better data isolation, simpler RLS, cleaner data ownership. Worth the provisioning complexity. |
| Email/password over magic link or SMS | Works offline after login. No paid SMS provider needed. Simple for manual account creation. |
| Role in auth metadata over roles table | Zero new tables for MVP. Migrate to a roles table when admin UI is needed. |
| Seed data manually over self-service onboarding | Validate the product first, then validate the onboarding. One variable at a time. |
| Public submissions without login | In a disaster, reporting a need shouldn't require an account. Accept spam risk for accessibility. |

## Deployment Strategy

First deployment: you (Jacob) set up everything for one partner org in the Philippines. Pre-load their real data. Hand them working accounts. Watch what happens. Iterate from feedback.

## Long-Term Vision (Post-MVP)

kapwahelp.org as a platform: new org signs up, gets isolated database provisioned automatically, configures their own categories/orgs/locations through a UI, operational in 15 minutes. Revenue model TBD if it scales.
