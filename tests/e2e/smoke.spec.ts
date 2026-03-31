import { test, expect } from "@playwright/test";

const LOCALES = ["en", "fil", "ilo"] as const;

// ── Needs page smoke tests ─────────────────────────────────────────

for (const locale of LOCALES) {
  test(`needs page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);

    // Header brand
    await expect(page.locator("text=Kapwa Help")).toBeVisible();

    // Navigation links
    await expect(page.locator("nav")).toBeVisible();

    // Locale switcher shows correct value
    const select = page.locator("header select");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue(locale);

    // Page has an h1
    await expect(page.locator("h1")).toBeVisible();

    // Screenshot for visual verification
    await page.screenshot({
      path: `tests/e2e/screenshots/needs-${locale}.png`,
      fullPage: true,
    });
  });
}

// ── Relief page smoke tests ────────────────────────────────────────

for (const locale of LOCALES) {
  test(`relief page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/relief`);

    // Header brand
    await expect(page.locator("text=Kapwa Help")).toBeVisible();

    // Page has an h1
    await expect(page.locator("h1")).toBeVisible();

    // Screenshot for visual verification
    await page.screenshot({
      path: `tests/e2e/screenshots/relief-${locale}.png`,
      fullPage: true,
    });
  });
}

// ── Stories page smoke tests ───────────────────────────────────────

for (const locale of LOCALES) {
  test(`stories page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/stories`);

    // Header brand
    await expect(page.locator("text=Kapwa Help")).toBeVisible();

    // Page has an h1
    await expect(page.locator("h1")).toBeVisible();

    // Screenshot for visual verification
    await page.screenshot({
      path: `tests/e2e/screenshots/stories-${locale}.png`,
      fullPage: true,
    });
  });
}

// ── Submit page smoke tests ─────────────────────────────────────────

for (const locale of LOCALES) {
  test(`submit page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/submit`);
    await expect(page.locator("text=Kapwa Help")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("form")).toBeVisible();
    const formButtons = page.locator("form button[type='button']");
    await expect(formButtons.first()).toBeVisible();
    await expect(page.locator("#contact_name")).toBeVisible();
    await expect(page.locator("#barangay_id")).toBeVisible();
    await expect(page.locator("#access_status")).toBeVisible();
    await expect(page.locator("form button[type='submit']")).toBeVisible();
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
  await select.selectOption("fil");
  await expect(page).toHaveURL(/\/fil$/);
  await expect(select).toHaveValue("fil");
});

test("nav links navigate between pages", async ({ page }) => {
  await page.goto("/en");

  // Click Relief nav link
  await page.locator("nav").getByText(/relief/i).click();
  await expect(page).toHaveURL(/\/en\/relief$/);
  await expect(page.locator("h1")).toBeVisible();
});
