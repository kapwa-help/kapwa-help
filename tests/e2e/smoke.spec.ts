import { test, expect } from "@playwright/test";

const LOCALES = ["en", "fil", "ilo"] as const;

// ── Relief Map page smoke tests ───────────────────────────────────

for (const locale of LOCALES) {
  test(`relief map page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/demo/${locale}`);

    // Header brand
    await expect(page.locator("text=Kapwa Help")).toBeVisible();

    // Navigation links
    await expect(page.locator("nav")).toBeVisible();

    // Locale switcher shows correct value
    const select = page.locator("header select");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue(locale);

    // Screenshot for visual verification
    await page.screenshot({
      path: `tests/e2e/screenshots/relief-map-${locale}.png`,
      fullPage: true,
    });
  });
}

// ── Dashboard page smoke tests ──────────────────────────────────

for (const locale of LOCALES) {
  test(`dashboard page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/demo/${locale}/dashboard`);

    // Header brand
    await expect(page.locator("text=Kapwa Help")).toBeVisible();

    // Page has an h1
    await expect(page.locator("h1")).toBeVisible();

    // Screenshot for visual verification
    await page.screenshot({
      path: `tests/e2e/screenshots/dashboard-${locale}.png`,
      fullPage: true,
    });
  });
}

// ── Report page smoke tests ─────────────────────────────────────────

for (const locale of LOCALES) {
  test(`report page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/demo/${locale}/report`);
    await expect(page.locator("text=Kapwa Help")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    await page.screenshot({
      path: `tests/e2e/screenshots/report-${locale}.png`,
      fullPage: true,
    });
  });
}

// ── Report page hazard form ────────────────────────────────────────

test("report page shows hazard form when selected", async ({ page }) => {
  await page.goto("/demo/en/report");
  await page.getByRole("button", { name: "Hazard" }).click();
  await expect(page.locator("#hazard-description")).toBeVisible();
});

// ── Navigation smoke tests ──────────────────────────────────────────

test("root renders the landing page", async ({ page }) => {
  await page.goto("/");

  // H1 copy
  await expect(
    page.getByRole("heading", { level: 1, name: /built on the ground/i }),
  ).toBeVisible();

  // Ginawa sa La Union stamp (provenance signal)
  await expect(page.getByText(/ginawa sa la union/i)).toBeVisible();

  // Primary CTA → /demo/en
  const primaryCta = page.getByRole("link", { name: /view live demo/i }).first();
  await expect(primaryCta).toBeVisible();
  await expect(primaryCta).toHaveAttribute("href", "/demo/en");

  // Header CTA
  const headerCta = page.getByRole("link", { name: /view demo/i });
  await expect(headerCta).toBeVisible();

  // Hero screenshot
  await expect(
    page.getByRole("img", { name: /kapwa help dashboard/i }),
  ).toBeVisible();

  // Story section H2
  await expect(
    page.getByRole("heading", { level: 2, name: /born during emong/i }),
  ).toBeVisible();

  // Features section presence (live map is #1)
  await expect(
    page.getByRole("heading", { level: 3, name: /view live needs and hazards/i }),
  ).toBeVisible();

  // CTA section
  await expect(
    page.getByRole("heading", { level: 2, name: /every skill set/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /get in touch/i }),
  ).toHaveAttribute("href", "mailto:contact@kapwahelp.org");

  // Footer
  await expect(page.getByText(/mit license/i)).toBeVisible();

  // Screenshot for visual verification
  await page.screenshot({
    path: "tests/e2e/screenshots/landing.png",
    fullPage: true,
  });
});

test("old /:locale path redirects to /demo/:locale", async ({ page }) => {
  await page.goto("/en");
  await expect(page).toHaveURL(/\/demo\/en$/);
});

test("old /:locale/dashboard redirects to /demo/:locale/dashboard", async ({ page }) => {
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/demo\/en\/dashboard$/);
});

test("old /:locale/report redirects to /demo/:locale/report", async ({ page }) => {
  await page.goto("/en/report");
  await expect(page).toHaveURL(/\/demo\/en\/report$/);
});

test("old /:locale/login redirects to the Flood Watch login", async ({ page }) => {
  await page.goto("/en/login");
  await expect(page).toHaveURL(/\/floodwatch\/login$/);
});

test("legacy /auth/callback redirects to the Flood Watch login", async ({ page }) => {
  await page.goto("/auth/callback");
  await expect(page).toHaveURL(/\/floodwatch\/login$/);
});

test("legacy /:locale/transparency redirects to /demo/:locale/dashboard", async ({ page }) => {
  await page.goto("/en/transparency");
  await expect(page).toHaveURL(/\/demo\/en\/dashboard$/);
});

test("locale switcher changes URL", async ({ page }) => {
  await page.goto("/demo/en");
  const select = page.locator("header select");
  await expect(select).toBeVisible();
  await select.selectOption("fil");
  await expect(page).toHaveURL(/\/demo\/fil$/);
  await expect(select).toHaveValue("fil");
});

test("nav links navigate between pages", async ({ page }) => {
  await page.goto("/demo/en");

  // Click Dashboard nav link
  await page.locator("nav").getByText(/dashboard/i).click();
  await expect(page).toHaveURL(/\/demo\/en\/dashboard$/);
  await expect(page.locator("h1")).toBeVisible();
});

test("mobile hamburger menu navigates between pages", async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/demo/en");

  // Desktop nav should be hidden
  await expect(page.locator("nav")).toBeHidden();

  // Hamburger button should be visible
  const menuButton = page.getByRole("button", { name: /menu/i });
  await expect(menuButton).toBeVisible();

  // Open menu and click Dashboard
  await menuButton.click();
  await page.getByTestId("mobile-nav").getByText(/dashboard/i).click();
  await expect(page).toHaveURL(/\/demo\/en\/dashboard$/);

  // Menu should close after navigation
  await expect(page.getByTestId("mobile-nav")).toBeHidden();

  // Screenshot
  await page.screenshot({
    path: "tests/e2e/screenshots/mobile-nav.png",
    fullPage: true,
  });
});
