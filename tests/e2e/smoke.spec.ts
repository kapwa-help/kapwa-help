import { test, expect } from "@playwright/test";

const LOCALES = ["en", "fil", "ilo"] as const;

// ── Relief Map page smoke tests ───────────────────────────────────

for (const locale of LOCALES) {
  test(`relief map page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);

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

// ── Transparency page smoke tests ────────────────────────────────

for (const locale of LOCALES) {
  test(`transparency page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/transparency`);

    // Header brand
    await expect(page.locator("text=Kapwa Help")).toBeVisible();

    // Page has an h1
    await expect(page.locator("h1")).toBeVisible();

    // Screenshot for visual verification
    await page.screenshot({
      path: `tests/e2e/screenshots/transparency-${locale}.png`,
      fullPage: true,
    });
  });
}

// ── Report page smoke tests ─────────────────────────────────────────

for (const locale of LOCALES) {
  test(`report page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/report`);
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
  await page.goto("/en/report");
  await page.getByRole("button", { name: "Hazard" }).click();
  await expect(page.locator("#hazard-description")).toBeVisible();
});

// ── Navigation smoke tests ──────────────────────────────────────────

test("root redirects to /en", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("invalid locale redirects to /en", async ({ page }) => {
  await page.goto("/xyz");
  await expect(page).toHaveURL(/\/en$/);
});

test("locale switcher changes URL", async ({ page }) => {
  await page.goto("/en");
  const select = page.locator("header select");
  await expect(select).toBeVisible();
  await select.selectOption("fil");
  await expect(page).toHaveURL(/\/fil$/);
  await expect(select).toHaveValue("fil");
});

test("nav links navigate between pages", async ({ page }) => {
  await page.goto("/en");

  // Click Transparency nav link
  await page.locator("nav").getByText(/transparency/i).click();
  await expect(page).toHaveURL(/\/en\/transparency$/);
  await expect(page.locator("h1")).toBeVisible();
});

test("mobile hamburger menu navigates between pages", async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/en");

  // Desktop nav should be hidden
  await expect(page.locator("nav")).toBeHidden();

  // Hamburger button should be visible
  const menuButton = page.getByRole("button", { name: /menu/i });
  await expect(menuButton).toBeVisible();

  // Open menu and click Transparency
  await menuButton.click();
  await page.getByTestId("mobile-nav").getByText(/transparency/i).click();
  await expect(page).toHaveURL(/\/en\/transparency$/);

  // Menu should close after navigation
  await expect(page.getByTestId("mobile-nav")).toBeHidden();

  // Screenshot
  await page.screenshot({
    path: "tests/e2e/screenshots/mobile-nav.png",
    fullPage: true,
  });
});
