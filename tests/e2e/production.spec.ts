import { test, expect, type Browser, type Page } from '@playwright/test';

async function createGuest(browser: Browser, language = 'Any language') {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Meet a stranger' }).click();
  await page.getByLabel('Conversation language').selectOption({ label: language });
  await page.getByLabel('I confirm that I am 18 years of age or older.').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.chat-page')).toBeVisible();
  return { context, page };
}

async function waitUntilConnected(page: Page) {
  await expect(page.locator('.stranger-info small')).toContainText('Connected', { timeout: 20_000 });
}

test('production smoke: guest chat, report, block, and mobile layout', async ({ browser }) => {
  const guestA = await createGuest(browser);
  const guestB = await createGuest(browser);

  try {
    await waitUntilConnected(guestA.page);
    await waitUntilConnected(guestB.page);

    const message = 'UNKNOWN end-to-end smoke test';
    await guestA.page.locator('textarea').fill(message);
    await guestA.page.getByRole('button', { name: 'Send message' }).click();
    await expect(guestB.page.locator('.message-bubble')).toContainText(message);

    await guestA.page.getByRole('button', { name: 'Report' }).click();
    await guestA.page.getByRole('button', { name: 'Submit report' }).click();
    await expect(guestA.page.locator('.toast')).toContainText('Report recorded', { timeout: 10_000 });

    await guestA.page.getByRole('button', { name: 'Block' }).click();
    await guestA.page.getByRole('button', { name: 'Block & leave' }).click();
    await expect(guestA.page.locator('.toast')).toContainText('blocked', { timeout: 10_000 });
    await expect(guestA.page.locator('.stranger-info small')).toContainText('Finding a stranger');
    await expect(guestB.page.locator('.stranger-info small')).toContainText('Finding a stranger');

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobileContext.newPage();
    try {
      await mobilePage.goto('/');
      const widths = await mobilePage.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
    } finally {
      await mobileContext.close();
    }
  } finally {
    await guestA.context.close();
    await guestB.context.close();
  }
});
