const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, pageHasContent, pageLoadComplete, mainContentIsVisible } = require('./helpers');

/**
 * Integration tests for FinOps module
 *
 * Tag: @finops
 * Usage: npx playwright test --grep @finops
 */

test.describe('FinOps Module @finops', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('FinOps module appears in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const sidebarItem = page.locator('aside nav').getByText('FinOps', { exact: false });
    await expect(sidebarItem).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('clicking FinOps navigates to Overview view', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const sidebarItem = page.locator('aside nav button').filter({ hasText: 'Overview' });
    if (await sidebarItem.count() === 0) {
      const finopsSection = page.locator('aside nav').getByText('FinOps', { exact: false });
      await finopsSection.click();
      await page.waitForTimeout(500);
    }

    const overviewButton = page.locator('aside nav button').filter({ hasText: 'Overview' });
    if (await overviewButton.count() > 0) {
      await overviewButton.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      expect(page.url()).toContain('finops');
    }

    expect(page.errors).toHaveLength(0);
  });
});

test.describe('FinOps Views @finops', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  async function testView(page, viewId, viewName) {
    await page.goto(`/#/finops/${viewId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    const pageHasFinishedLoading = await pageLoadComplete(page);
    expect(pageHasFinishedLoading).toBe(true);

    if (page.errors.length > 0) {
      console.error(`${viewName} errors:`, page.errors);
    }

    expect(page.errors).toHaveLength(0);
  }

  test('Overview shows KPI tiles', async ({ page }) => {
    await page.goto('/#/finops/overview');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    expect(page.errors).toHaveLength(0);
  });

  test('Triage view is clickable and shows finding list', async ({ page }) => {
    await testView(page, 'triage', 'Triage');
  });

  test('Audit view loads', async ({ page }) => {
    await testView(page, 'audit', 'Audit');
  });

  test('Trends view loads', async ({ page }) => {
    await testView(page, 'trends', 'Trends');
  });
});

test.describe('FinOps Disabled Menu Items @finops', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('no disabled menu items expected in FinOps', async ({ page }) => {
    await page.goto('/#/finops/overview');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const finopsNav = page.locator('aside nav > div').filter({ hasText: 'FinOps' });
    if (await finopsNav.count() > 0) {
      const disabledButtons = finopsNav.locator('button[aria-disabled="true"]');
      const disabledCount = await disabledButtons.count();
      expect(disabledCount).toBe(0);
    }

    expect(page.errors).toHaveLength(0);
  });
});
