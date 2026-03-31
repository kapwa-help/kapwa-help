# Routing Restructure Plan

**Status:** Not started — plan before implementing

## Decision

Split the current single-page dashboard into separate pages. The dashboard today (`DashboardPage.tsx`) renders everything: hero, needs summary cards, needs coordination map, donations, deployments, goods, and distribution map. This serves two different audiences on one long scroll.

## New Route Structure

| Route | Page | Content | Audience |
|-------|------|---------|----------|
| `/:locale` | **Needs** | Hero (static identity + active event banner), needs summary cards, needs coordination map | Field responders, community leaders |
| `/:locale/relief` | **Relief Operations** | Donations summary, deployment hubs, goods by category, aid distribution map | Donors, auditors |
| `/:locale/stories` | **Stories** (placeholder) | Future CMS content — processes, learnings, journals (see r0droald/LUaid#13) | General public |
| `/:locale/submit` | **Submit Form** | Unchanged | Field reporters |

## Rationale

- **Needs as landing page:** Hannah's scope (docs/scope.md) is needs-first. Field responders hitting the site during a disaster need the operational view immediately, not donation charts.
- **Separate relief ops:** Donors/auditors want accountability data (donations, deployments, distribution). Different audience, different urgency level. Splitting reduces cognitive load for both groups.
- **Stories placeholder:** Hannah's project history (docs/project-history.md) lists "knowledge sharing" and CMS (r0droald/LUaid#13) as goals. Adding the route now while restructuring avoids a second routing refactor.
- **Performance:** Each page fetches fewer queries. Marginal network gain but meaningful for perceived speed on mobile in low-connectivity areas.

## Key Implementation Notes

- `DashboardPage.tsx` currently fetches all data in one `Promise.all` — split the queries so each page only fetches what it needs
- The hero section (site identity + active event banner) was just refactored to be static/i18n-driven, decoupled from event data. It lives on the Needs page.
- Header (`src/components/Header.tsx`) needs navigation links to switch between Needs, Relief, and Stories
- i18n keys will be needed for new nav items and the Stories placeholder
- The "Relief Operations" section heading and components (`SummaryCards`, `DonationsByOrg`, `DeploymentHubs`, `GoodsByCategory`, `AidDistributionMap`) move to their own page
- Router config is in the file that defines routes (check `src/main.tsx` or `src/App.tsx`)
