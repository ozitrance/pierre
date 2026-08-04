import { describe, expect, test } from 'bun:test';

import { CodeView } from '../src/components/CodeView';
import type { CodeViewDiffItem } from '../src/types';
import { parseDiffFromFile } from '../src/utils/parseDiffFromFile';
import { createRoot, installDom, renderItems, wait } from './domHarness';

function diffItem(id: string, expandUnchanged?: boolean): CodeViewDiffItem {
  return {
    id,
    type: 'diff',
    expandUnchanged,
    fileDiff: parseDiffFromFile(
      {
        name: `${id}.txt`,
        contents: 'one\ntwo\nthree\nfour\nfive\n',
      },
      {
        name: `${id}.txt`,
        contents: 'one\ntwo changed\nthree\nfour\nfive\n',
      },
      { context: 0 }
    ),
  };
}

describe('CodeView item expandUnchanged state', () => {
  test('overrides the shared option for only the selected item', async () => {
    const { cleanup } = installDom();
    const viewer = new CodeView({ expandUnchanged: false });

    try {
      viewer.setup(createRoot());
      await renderItems(viewer, [
        diffItem('selected', true),
        diffItem('other'),
      ]);

      const selected = viewer
        .getRenderedItems()
        .find((item) => item.id === 'selected');
      const other = viewer
        .getRenderedItems()
        .find((item) => item.id === 'other');

      expect(selected?.type).toBe('diff');
      expect(other?.type).toBe('diff');
      if (selected?.type !== 'diff' || other?.type !== 'diff') {
        throw new Error('Expected both diff items to render');
      }
      expect(selected.instance.options.expandUnchanged).toBe(true);
      expect(other.instance.options.expandUnchanged).toBe(false);
    } finally {
      viewer.cleanUp();
      await wait(0);
      cleanup();
    }
  });

  test('falls back to the shared option when no item override exists', async () => {
    const { cleanup } = installDom();
    const viewer = new CodeView({ expandUnchanged: true });

    try {
      viewer.setup(createRoot());
      await renderItems(viewer, [diffItem('shared')]);
      const rendered = viewer.getRenderedItems()[0];

      expect(rendered?.type).toBe('diff');
      if (rendered?.type !== 'diff') {
        throw new Error('Expected a diff item to render');
      }
      expect(rendered.instance.options.expandUnchanged).toBe(true);
    } finally {
      viewer.cleanUp();
      await wait(0);
      cleanup();
    }
  });
});
