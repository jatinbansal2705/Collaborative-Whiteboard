import { expect, test } from '@playwright/test';

/**
 * End-to-end coverage for canvas drawing. These run against the real NestJS
 * API and exercise the browser -> Next.js -> API round trip, including the
 * debounced document autosave.
 *
 * Regression: shape tools (rectangle/ellipse/arrow/line) must produce a
 * committed element after a click-drag gesture. The draft gesture used to
 * keep only a single point, so `handleDragEnd` discarded the shape.
 */

const uniqueEmail = () =>
  `e2e-draw-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.com`;
const VALID_PASSWORD = 'Whiteboard1';

async function registerAndOpenBoard(page: import('@playwright/test').Page) {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
  await page.getByLabel('Confirm password').fill(VALID_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(
    page.getByRole('button', { name: 'New board' }).first(),
  ).toBeVisible();

  await page.getByRole('button', { name: 'New board' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const title = `Draw ${Date.now()}`;
  await page.getByRole('dialog').getByRole('textbox').fill(title);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /create/i })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('link', { name: new RegExp(title) })
    .first()
    .click();
  await page.waitForURL(/board\//);
}

test('a drag with the rectangle tool commits and autosaves a shape', async ({
  page,
}) => {
  await registerAndOpenBoard(page);

  const stage = page.locator('canvas').first();
  await expect(stage).toBeVisible();

  const savedBodies: { data?: { elements?: { type: string }[] } }[] = [];
  page.on('response', async (response) => {
    const request = response.request();
    if (
      request.method() === 'PATCH' &&
      /\/data$/.test(new URL(request.url()).pathname)
    ) {
      try {
        savedBodies.push(request.postDataJSON());
      } catch {
        // Ignore non-JSON request bodies.
      }
    }
  });

  await page
    .getByRole('button', { name: /rectangle/i })
    .first()
    .click();

  const box = (await stage.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 180, cy + 120, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(
      () =>
        savedBodies.some((body) =>
          body?.data?.elements?.some((element) => element.type === 'rectangle'),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
});
