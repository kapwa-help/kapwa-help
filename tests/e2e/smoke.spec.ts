import { test, expect } from "@playwright/test";

const LOCALES = ["en", "fil", "ilo"] as const;

// ── Dashboard smoke tests ───────────────────────────────────────────

for (const locale of LOCALES) {
  test(`dashboard renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);

    // Header brand
    await expect(page.locator("text=LUaid.org")).toBeVisible();

    // Locale switcher shows correct value
    const select = page.locator("header select");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue(locale);

    // Page has an h1
    await expect(page.locator("h1")).toBeVisible();

    // Screenshot for visual verification
    await page.screenshot({
      path: `tests/e2e/screenshots/dashboard-${locale}.png`,
      fullPage: true,
    });
  });
}

// ── Submit page smoke tests ─────────────────────────────────────────

for (const locale of LOCALES) {
  test(`submit page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/submit`);

    // Header brand
    await expect(page.locator("text=LUaid.org")).toBeVisible();

    // Page heading
    await expect(page.locator("h1")).toBeVisible();

    // Form exists
    await expect(page.locator("form")).toBeVisible();

    // Type toggle buttons (request / feedback) + share location button
    const formButtons = page.locator("form button[type='button']");
    await expect(formButtons.first()).toBeVisible();

    // Required fields exist
    await expect(page.locator("#contact_name")).toBeVisible();
    await expect(page.locator("#barangay_id")).toBeVisible();
    await expect(page.locator("#aid_category_id")).toBeVisible();

    // Submit button
    await expect(page.locator("form button[type='submit']")).toBeVisible();

    // Screenshot for visual verification
    await page.screenshot({
      path: `tests/e2e/screenshots/submit-${locale}.png`,
      fullPage: true,
    });
  });
}

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

  // Switch to Filipino
  await select.selectOption("fil");
  await expect(page).toHaveURL(/\/fil$/);

  // Verify the select updated
  await expect(select).toHaveValue("fil");
});
