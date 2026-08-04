import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __fileTreeMetadataLayoutFixtureReady?: boolean;
  }
}

type LayoutMeasurement = {
  contentWidth: number;
  messageWidth: number;
  metadataWidth: number;
};

async function measurePriorityRow(
  page: import('@playwright/test').Page
): Promise<LayoutMeasurement> {
  return page.evaluate(() => {
    const host = document.querySelector('file-tree-container');
    const row = host?.shadowRoot?.querySelector(
      'button[data-item-path="priority-name.ts"]'
    );
    const content = row?.querySelector('[data-item-section="content"]');
    const metadata = row?.querySelector('[data-item-section="metadata"]');
    const message = row?.querySelector('[data-item-column="message"]');

    if (
      !(content instanceof HTMLElement) ||
      !(metadata instanceof HTMLElement) ||
      !(message instanceof HTMLElement)
    ) {
      throw new Error('Expected the priority row and its metadata cells.');
    }

    return {
      contentWidth: content.getBoundingClientRect().width,
      messageWidth: message.getBoundingClientRect().width,
      metadataWidth: metadata.getBoundingClientRect().width,
    };
  });
}

test('keeps the item name ahead of metadata at narrow widths', async ({
  page,
}) => {
  await page.goto('/test/e2e/fixtures/file-tree-metadata-layout.html');
  await page.waitForFunction(
    () => window.__fileTreeMetadataLayoutFixtureReady === true
  );

  for (const mode of ['tree', 'explorer'] as const) {
    await page.locator(`[data-view-mode="${mode}"]`).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const host = document.querySelector('file-tree-container');
          return host?.shadowRoot
            ?.querySelector('[data-file-tree-virtualized-root="true"]')
            ?.getAttribute('data-file-tree-view-mode');
        })
      )
      .toBe(mode);

    const measurement = await measurePriorityRow(page);

    expect(measurement.contentWidth).toBeGreaterThan(80);
    expect(measurement.metadataWidth).toBeLessThan(160);
    expect(measurement.messageWidth).toBeLessThan(160);
  }
});