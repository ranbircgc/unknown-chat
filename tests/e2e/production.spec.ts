import { test, expect, type Browser, type Page } from '@playwright/test';

type GuestOptions = { language?: string; interests?: string[] };

async function createGuest(browser: Browser, options: GuestOptions = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: options.interests ? 'Match by interests' : 'Meet a stranger' }).click();
  if (options.interests) {
    await page.getByRole('button', { name: 'Find my people' }).click();
    for (const interest of options.interests) await page.getByRole('button', { name: interest, exact: true }).click();
  }
  await page.getByLabel('Conversation language').selectOption({ label: options.language || 'Any language' });
  await page.getByLabel('I confirm that I am 18 years of age or older.').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.chat-page')).toBeVisible();
  return { context, page };
}

async function waitUntilConnected(page: Page) {
  await expect(page.locator('.stranger-info small')).toContainText('Connected', { timeout: 20_000 });
}
async function waitUntilWaiting(page: Page) {
  await expect(page.locator('.stranger-info small')).toContainText('Finding a stranger', { timeout: 10_000 });
}

test('production: chat, report, block, matching preferences, and mobile layout', async ({ browser }) => {
  const guestA = await createGuest(browser);
  const guestB = await createGuest(browser);
  try {
    await waitUntilConnected(guestA.page);
    await waitUntilConnected(guestB.page);
    const message = 'UNKNOWN end-to-end smoke test';
    await guestA.page.locator('textarea').fill(message);
    await guestA.page.getByRole('button', { name: 'Send message' }).click();
    await expect(guestB.page.locator('.message-bubble')).toContainText(message);

    await guestA.page.locator('button[title="Report"]').click();
    await guestA.page.getByRole('button', { name: 'Submit report' }).click();
    await expect(guestA.page.locator('.toast')).toContainText('Report recorded', { timeout: 10_000 });

    await guestA.page.locator('button[title="Block"]').click();
    await guestA.page.getByRole('button', { name: 'Block & leave' }).click();
    await expect(guestA.page.locator('.toast')).toContainText('blocked', { timeout: 10_000 });
    await waitUntilWaiting(guestA.page);
    await waitUntilWaiting(guestB.page);

    await guestA.page.setViewportSize({ width: 390, height: 844 });
    const widths = await guestA.page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
    await expect(guestA.page.locator('textarea')).toBeVisible();
  } finally {
    await guestA.context.close();
    await guestB.context.close();
  }

  // Five session creations total: within the current 5-per-10-minute cap.
  const englishAi = await createGuest(browser, { language: 'English', interests: ['AI & ML'] });
  const hindiMusic = await createGuest(browser, { language: 'Hindi', interests: ['Music'] });
  const anyAi = await createGuest(browser, { language: 'Any language', interests: ['AI & ML'] });
  try {
    await waitUntilConnected(englishAi.page);
    await waitUntilConnected(anyAi.page);
    await waitUntilWaiting(hindiMusic.page);
  } finally {
    await englishAi.context.close();
    await hindiMusic.context.close();
    await anyAi.context.close();
  }
});
