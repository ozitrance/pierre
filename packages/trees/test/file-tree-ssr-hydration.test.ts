import { describe, expect, test } from 'bun:test';

import { serializeFileTreeSsrPayload } from '../src/ssr';
import { flushDom, installDom } from './helpers/dom';
import { loadFileTree, loadPreloadFileTree } from './helpers/loadFileTree';
import {
  getFocusedItemPath,
  getItemButton,
  getSelectedItemPaths,
  getUnsafeCssStyle,
} from './helpers/renderHarness';

describe('file-tree SSR and hydration', () => {
  test('preloadFileTree returns SSR-safe initial html', async () => {
    const preloadFileTree = await loadPreloadFileTree();

    const payload = preloadFileTree({
      flattenEmptyDirectories: true,
      initialExpansion: 'open',
      paths: ['README.md', 'src/index.ts', 'src/lib/utils.ts'],
      initialVisibleRowCount: 120 / 30,
    });

    const parserHtml = serializeFileTreeSsrPayload(payload);
    const domHtml = serializeFileTreeSsrPayload(payload, 'dom');
    expect(parserHtml).toContain('<file-tree-container');
    expect(parserHtml).toContain('template shadowrootmode="open"');
    expect(domHtml).toContain('data-file-tree-shadowrootmode="open"');
    expect(domHtml).not.toContain('template shadowrootmode="open"');
    expect(payload.shadowHtml).toContain(
      'data-file-tree-virtualized-root="true"'
    );
    expect(payload.shadowHtml).not.toContain(
      'data-file-tree-sticky-overlay="true"'
    );
    expect(payload.shadowHtml).toContain('README.md');
  });

  test('preloadFileTree includes initial selected row attributes', async () => {
    const preloadFileTree = await loadPreloadFileTree();

    const payload = preloadFileTree({
      flattenEmptyDirectories: true,
      initialExpansion: 'open',
      initialSelectedPaths: ['README.md'],
      paths: ['README.md', 'src/index.ts', 'src/lib/utils.ts'],
      initialVisibleRowCount: 120 / 30,
    });

    expect(payload.shadowHtml).toMatch(
      /aria-selected="true"[^>]*data-item-path="README\.md"[^>]*data-item-selected="true"/
    );
  });

  test('initialSelectedPaths preserve selected and focused state through preload and hydrate', async () => {
    const { cleanup, dom } = installDom();
    try {
      const preloadFileTree = await loadPreloadFileTree();
      const FileTree = await loadFileTree();
      const options = {
        flattenEmptyDirectories: false,
        id: 'pst-hydrate-initial-selection',
        initialExpansion: 'open',
        initialSelectedPaths: ['a.ts', 'c.ts'],
        paths: ['a.ts', 'b.ts', 'c.ts'],
        initialVisibleRowCount: 120 / 30,
      } satisfies ConstructorParameters<typeof FileTree>[0];
      const payload = preloadFileTree(options);

      expect(payload.shadowHtml).toMatch(
        /aria-selected="true"[^>]*data-item-path="a\.ts"[^>]*data-item-selected="true"/
      );
      expect(payload.shadowHtml).toMatch(
        /aria-selected="true"[^>]*data-item-path="c\.ts"[^>]*data-item-selected="true"/
      );
      expect(payload.shadowHtml).toMatch(
        /data-item-path="c\.ts"[^>]*tabindex="0"/
      );

      const mount = dom.window.document.createElement('div');
      mount.innerHTML = serializeFileTreeSsrPayload(payload, 'dom');
      dom.window.document.body.appendChild(mount);

      const host = mount.querySelector('file-tree-container');
      if (!(host instanceof dom.window.HTMLElement)) {
        throw new Error('expected SSR host');
      }

      const fileTree = new FileTree(options);
      fileTree.hydrate({ fileTreeContainer: host });
      await flushDom();

      expect(fileTree.getSelectedPaths()).toEqual(['a.ts', 'c.ts']);
      expect(fileTree.getFocusedPath()).toBe('c.ts');
      expect(getSelectedItemPaths(host.shadowRoot, dom)).toEqual([
        'a.ts',
        'c.ts',
      ]);
      expect(getFocusedItemPath(host.shadowRoot, dom)).toBe('c.ts');

      fileTree.cleanUp();
    } finally {
      cleanup();
    }
  });

  test('render injects wrapped unsafeCSS into the shadow root', async () => {
    const { cleanup, dom } = installDom();
    try {
      const FileTree = await loadFileTree();
      const mount = dom.window.document.createElement('div');
      dom.window.document.body.appendChild(mount);
      const fileTree = new FileTree({
        flattenEmptyDirectories: true,
        paths: ['README.md'],
        unsafeCSS: '[data-item-path="README.md"] { color: rgb(255 0 0); }',
        initialVisibleRowCount: 120 / 30,
      });

      fileTree.render({ containerWrapper: mount });
      await flushDom();

      const unsafeStyle = getUnsafeCssStyle(
        fileTree.getFileTreeContainer()?.shadowRoot,
        dom
      );
      expect(unsafeStyle).not.toBeNull();
      expect(unsafeStyle?.textContent).toContain('@layer unsafe');
      expect(unsafeStyle?.textContent).toContain('color: rgb(255 0 0);');

      fileTree.cleanUp();
    } finally {
      cleanup();
    }
  });

  test('preloadFileTree and hydrate keep one wrapped unsafeCSS style element', async () => {
    const { cleanup, dom } = installDom();
    try {
      const FileTree = await loadFileTree();
      const preloadFileTree = await loadPreloadFileTree();
      const options = {
        flattenEmptyDirectories: true,
        id: 'pst-unsafe-css-hydration',
        paths: ['README.md'],
        unsafeCSS: 'button[data-type="item"] { color: rgb(255 0 0); }',
        initialVisibleRowCount: 120 / 30,
      } satisfies ConstructorParameters<typeof FileTree>[0];
      const payload = preloadFileTree(options);

      expect(payload.shadowHtml).toContain('data-file-tree-unsafe-css');
      expect(payload.shadowHtml).toContain('@layer unsafe');

      const mount = dom.window.document.createElement('div');
      mount.innerHTML = serializeFileTreeSsrPayload(payload, 'dom');
      dom.window.document.body.appendChild(mount);

      const host = mount.querySelector('file-tree-container');
      if (!(host instanceof dom.window.HTMLElement)) {
        throw new Error('expected SSR host');
      }

      expect(
        payload.shadowHtml.match(/data-file-tree-unsafe-css/g)?.length ?? 0
      ).toBe(1);

      const fileTree = new FileTree(options);
      fileTree.hydrate({ fileTreeContainer: host });
      await flushDom();

      expect(
        host.shadowRoot?.querySelectorAll('style[data-file-tree-unsafe-css]')
          .length
      ).toBe(1);
      const unsafeStyle = getUnsafeCssStyle(host.shadowRoot, dom);
      expect(unsafeStyle?.textContent).toContain('@layer unsafe');
      expect(unsafeStyle?.textContent).toContain('color: rgb(255 0 0);');

      fileTree.cleanUp();
    } finally {
      cleanup();
    }
  });

  test('preloadFileTree escapes unsafeCSS before embedding SSR styles', async () => {
    const preloadFileTree = await loadPreloadFileTree();
    const payload = preloadFileTree({
      paths: ['README.md'],
      unsafeCSS:
        'button[data-type="item"]::after { content: "</style><div data-escape-break></div>"; }',
      initialVisibleRowCount: 120 / 30,
    });

    expect(payload.shadowHtml).toContain('<\\/style><div data-escape-break');
    expect(payload.shadowHtml).not.toContain('</style><div data-escape-break');
  });
  test('preloadFileTree sorts unsorted top-level entries before files and keeps root chains flattened', async () => {
    const preloadFileTree = await loadPreloadFileTree();

    const payload = preloadFileTree({
      flattenEmptyDirectories: true,
      paths: [
        'README.md',
        'package.json',
        'assets/images/social/logo.png',
        'assets/images/social/banner.png',
        'docs/guides/getting-started.md',
        'docs/guides/faq.md',
        'src/index.ts',
        'src/lib/utils.ts',
        'src/lib/theme.ts',
        'src/components/Button.tsx',
      ],
      initialVisibleRowCount: 460 / 30,
    });

    expect(
      Array.from(
        payload.shadowHtml.matchAll(/data-item-path="([^"]+)"/g),
        (match) => match[1] ?? ''
      ).filter((path) => path.length > 0)
    ).toEqual([
      'assets/images/social/',
      'docs/guides/',
      'src/',
      'package.json',
      'README.md',
    ]);
  });

  test('hydration keeps row content aligned with row paths for unsorted raw input', async () => {
    const { cleanup, dom } = installDom();
    try {
      const FileTree = await loadFileTree();
      const preloadFileTree = await loadPreloadFileTree();

      const unsortedPaths = [
        'README.md',
        'package.json',
        'assets/images/social/logo.png',
        'assets/images/social/banner.png',
        'docs/guides/getting-started.md',
        'docs/guides/faq.md',
        'src/index.ts',
        'src/lib/utils.ts',
        'src/lib/theme.ts',
        'src/components/Button.tsx',
      ] as const;
      const options = {
        dragAndDrop: true,
        flattenEmptyDirectories: true,
        id: 'pst-hydrate-shape',
        initialExpandedPaths: [
          'assets/images/social/',
          'docs/guides/',
          'src/',
          'src/lib/',
        ],
        paths: unsortedPaths,
        initialVisibleRowCount: 460 / 30,
      } satisfies ConstructorParameters<typeof FileTree>[0];
      const payload = preloadFileTree(options);

      const mount = dom.window.document.createElement('div');
      mount.innerHTML = serializeFileTreeSsrPayload(payload, 'dom');
      dom.window.document.body.appendChild(mount);

      const host = mount.querySelector('file-tree-container');
      if (!(host instanceof dom.window.HTMLElement)) {
        throw new Error('expected SSR host');
      }

      const ssrPaths = Array.from(
        payload.shadowHtml.matchAll(/data-item-path="([^"]+)"/g),
        (match) => match[1] ?? ''
      ).filter((path) => path.length > 0);

      const fileTree = new FileTree(options);
      fileTree.hydrate({ fileTreeContainer: host });
      await flushDom();

      const shadowRoot = host.shadowRoot;
      const hydratedPaths = Array.from(
        shadowRoot?.querySelectorAll('button[data-type="item"]') ?? []
      )
        .filter(
          (button): button is HTMLButtonElement =>
            button instanceof dom.window.HTMLButtonElement
        )
        .map((button) => button.dataset.itemPath)
        .filter((path): path is string => path != null);
      const getContentText = (path: string): string =>
        getItemButton(shadowRoot, dom, path)
          .querySelector('[data-item-section="content"]')
          ?.textContent?.replaceAll(/\s+/g, ' ')
          .trim() ?? '';

      expect(hydratedPaths).toEqual(ssrPaths);
      expect(getContentText('README.md')).toContain('README');
      expect(getContentText('README.md')).not.toContain('assets');
      expect(getContentText('package.json')).toContain('package');
      expect(getContentText('package.json')).not.toContain('banner');
      const flattenedAssetsContent = getItemButton(
        shadowRoot,
        dom,
        'assets/images/social/'
      ).querySelector('[data-item-section="content"]');
      expect(getContentText('assets/images/social/')).toContain('assets');
      expect(getContentText('assets/images/social/')).toContain('social');
      expect(
        flattenedAssetsContent?.querySelector('[data-icon-name]')
      ).toBeNull();
      expect(
        getItemButton(shadowRoot, dom, 'README.md').querySelector(
          '[data-item-section="icon"] [data-icon-name]'
        )
      ).not.toBeNull();

      fileTree.cleanUp();
    } finally {
      cleanup();
    }
  });

  test('preloadFileTree renders explorer mode markup for viewMode explorer', async () => {
    const preloadFileTree = await loadPreloadFileTree();

    const payload = preloadFileTree({
      initialExpansion: 'open',
      paths: ['README.md', 'src/index.ts', 'src/lib/utils.ts'],
      initialVisibleRowCount: 8,
      viewMode: 'explorer',
    });

    expect(payload.shadowHtml).toContain('role="listbox"');
    expect(payload.shadowHtml).toContain('data-file-tree-view-mode="explorer"');
    expect(payload.shadowHtml).toContain('data-file-tree-explorer-bar');
    expect(payload.shadowHtml).toContain('#file-tree-icon-folder');
    // The root listing is flat: the directory row appears, its children don't.
    expect(payload.shadowHtml).toContain('data-item-path="src/"');
    expect(payload.shadowHtml).not.toContain('data-item-path="src/index.ts"');
  });

  test('hydrating an explorer payload with matching options keeps explorer markup', async () => {
    const { cleanup, dom } = installDom();
    try {
      const preloadFileTree = await loadPreloadFileTree();
      const FileTree = await loadFileTree();
      const options = {
        id: 'pst-hydrate-explorer-matched',
        initialExpansion: 'open',
        paths: ['README.md', 'src/index.ts', 'src/lib/utils.ts'],
        initialVisibleRowCount: 8,
        viewMode: 'explorer',
      } satisfies ConstructorParameters<typeof FileTree>[0];
      const payload = preloadFileTree(options);
      const mount = dom.window.document.createElement('div');
      mount.innerHTML = serializeFileTreeSsrPayload(payload, 'dom');
      dom.window.document.body.appendChild(mount);
      const host = mount.querySelector('file-tree-container');
      if (!(host instanceof dom.window.HTMLElement)) {
        throw new Error('expected SSR host');
      }

      const fileTree = new FileTree(options);
      fileTree.hydrate({ fileTreeContainer: host });
      await flushDom();

      const rootElement = host.shadowRoot?.querySelector(
        '[data-file-tree-virtualized-root]'
      );
      expect(rootElement?.getAttribute('role')).toBe('listbox');
      expect(
        host.shadowRoot?.querySelector('[data-file-tree-explorer-bar]')
      ).not.toBeNull();

      fileTree.cleanUp();
    } finally {
      cleanup();
    }
  });

  test('hydrating a payload from a different view mode falls back to a clean render', async () => {
    const { cleanup, dom } = installDom();
    try {
      const preloadFileTree = await loadPreloadFileTree();
      const FileTree = await loadFileTree();
      const baseOptions = {
        id: 'pst-hydrate-explorer-mismatch',
        initialExpansion: 'open',
        paths: ['README.md', 'src/index.ts', 'src/lib/utils.ts'],
        initialVisibleRowCount: 8,
      } satisfies ConstructorParameters<typeof FileTree>[0];
      // Server rendered the default tree mode; the client model starts in
      // explorer mode. Adopting the tree DOM via hydration would leave the
      // stale role and missing explorer bar in place, so hydrate() must
      // detect the drift and render fresh.
      const payload = preloadFileTree(baseOptions);
      const mount = dom.window.document.createElement('div');
      mount.innerHTML = serializeFileTreeSsrPayload(payload, 'dom');
      dom.window.document.body.appendChild(mount);
      const host = mount.querySelector('file-tree-container');
      if (!(host instanceof dom.window.HTMLElement)) {
        throw new Error('expected SSR host');
      }

      const fileTree = new FileTree({
        ...baseOptions,
        viewMode: 'explorer',
      });
      fileTree.hydrate({ fileTreeContainer: host });
      await flushDom();

      const rootElement = host.shadowRoot?.querySelector(
        '[data-file-tree-virtualized-root]'
      );
      expect(rootElement?.getAttribute('role')).toBe('listbox');
      expect(rootElement?.getAttribute('data-file-tree-view-mode')).toBe(
        'explorer'
      );
      expect(
        host.shadowRoot?.querySelector('[data-file-tree-explorer-bar]')
      ).not.toBeNull();
      // And the reverse: explorer payload adopted by a tree-mode model.
      const reversePayload = preloadFileTree({
        ...baseOptions,
        id: 'pst-hydrate-tree-mismatch',
        viewMode: 'explorer',
      });
      const reverseMount = dom.window.document.createElement('div');
      reverseMount.innerHTML = serializeFileTreeSsrPayload(
        reversePayload,
        'dom'
      );
      dom.window.document.body.appendChild(reverseMount);
      const reverseHost = reverseMount.querySelector('file-tree-container');
      if (!(reverseHost instanceof dom.window.HTMLElement)) {
        throw new Error('expected SSR host');
      }

      const treeFileTree = new FileTree({
        ...baseOptions,
        id: 'pst-hydrate-tree-mismatch',
      });
      treeFileTree.hydrate({ fileTreeContainer: reverseHost });
      await flushDom();

      const reverseRootElement = reverseHost.shadowRoot?.querySelector(
        '[data-file-tree-virtualized-root]'
      );
      expect(reverseRootElement?.getAttribute('role')).toBe('tree');
      expect(
        reverseHost.shadowRoot?.querySelector('[data-file-tree-explorer-bar]')
      ).toBeNull();

      fileTree.cleanUp();
      treeFileTree.cleanUp();
    } finally {
      cleanup();
    }
  });

  test('preloadFileTree renders columns mode markup for viewMode columns', async () => {
    const preloadFileTree = await loadPreloadFileTree();

    const payload = preloadFileTree({
      explorer: { initialDirectory: 'src' },
      initialExpansion: 'open',
      paths: ['README.md', 'src/index.ts', 'src/lib/utils.ts'],
      initialVisibleRowCount: 8,
      viewMode: 'columns',
    });

    expect(payload.shadowHtml).toContain('data-file-tree-view-mode="columns"');
    expect(payload.shadowHtml).toContain('role="group"');
    expect(payload.shadowHtml).toContain(
      'data-file-tree-columns-wrap="active"'
    );
    // Root ancestor pane with the chain child ('src/') highlighted.
    expect(payload.shadowHtml).toContain('data-file-tree-column="ancestor"');
    expect(payload.shadowHtml).toMatch(
      /data-item-path="src\/"[^>]*data-item-chain-selected="true"/
    );
    // Entering 'src/' focuses its first row, the 'lib' directory, so a
    // preview pane of its children renders too.
    expect(payload.shadowHtml).toContain('data-file-tree-column="preview"');
    expect(payload.shadowHtml).toContain('data-item-path="src/lib/utils.ts"');
    // Directory rows carry the descend chevron in every pane by default;
    // `columnsDescendAffordance: false` drops it everywhere.
    expect(payload.shadowHtml).toContain('data-item-column-descend');
    const bareChevronPayload = preloadFileTree({
      columnsDescendAffordance: false,
      explorer: { initialDirectory: 'src' },
      initialExpansion: 'open',
      paths: ['README.md', 'src/index.ts', 'src/lib/utils.ts'],
      initialVisibleRowCount: 8,
      viewMode: 'columns',
    });
    expect(bareChevronPayload.shadowHtml).not.toContain(
      'data-item-column-descend'
    );
  });

  test('columns mode side panes carry the git attribute lanes', async () => {
    const preloadFileTree = await loadPreloadFileTree();

    const payload = preloadFileTree({
      explorer: { initialDirectory: 'src' },
      gitStatus: [{ path: 'src/lib/utils.ts', status: 'modified' }],
      initialExpansion: 'open',
      paths: ['README.md', 'src/index.ts', 'src/lib/utils.ts'],
      initialVisibleRowCount: 8,
      viewMode: 'columns',
    });

    // The first 'src/' row is in the root ancestor pane (side panes render
    // before the active pane). It contains the change, so it shows the same
    // folder dot it would show as the active listing.
    const [ancestorRow] =
      payload.shadowHtml.match(
        /<button[^>]*data-item-path="src\/"[\s\S]*?<\/button>/
      ) ?? [];
    expect(ancestorRow).toBeDefined();
    expect(ancestorRow).toContain('data-item-contains-git-change="true"');
    expect(ancestorRow).toContain('data-item-section="git"');
    // The descend chevron sits next to the name, before the right-aligned
    // attribute lanes.
    const descendIndex = ancestorRow!.indexOf('data-item-column-descend');
    expect(descendIndex).toBeGreaterThan(-1);
    expect(descendIndex).toBeLessThan(
      ancestorRow!.indexOf('data-item-section="git"')
    );

    // Preview pane (children of the focused 'lib' directory): the modified
    // file carries its status letter there too.
    const previewPane = payload.shadowHtml.slice(
      payload.shadowHtml.indexOf('data-file-tree-column="preview"')
    );
    expect(previewPane).toContain('data-item-git-status="modified"');
    expect(previewPane).toContain('data-item-section="git"');
  });

  test('hydrating a columns payload with matching options keeps columns markup', async () => {
    const { cleanup, dom } = installDom();
    try {
      const preloadFileTree = await loadPreloadFileTree();
      const FileTree = await loadFileTree();
      const options = {
        explorer: { initialDirectory: 'src' },
        id: 'pst-hydrate-columns-matched',
        initialExpansion: 'open',
        paths: ['README.md', 'src/index.ts', 'src/lib/utils.ts'],
        initialVisibleRowCount: 8,
        viewMode: 'columns',
      } satisfies ConstructorParameters<typeof FileTree>[0];
      const payload = preloadFileTree(options);
      const mount = dom.window.document.createElement('div');
      mount.innerHTML = serializeFileTreeSsrPayload(payload, 'dom');
      dom.window.document.body.appendChild(mount);
      const host = mount.querySelector('file-tree-container');
      if (!(host instanceof dom.window.HTMLElement)) {
        throw new Error('expected SSR host');
      }

      const fileTree = new FileTree(options);
      fileTree.hydrate({ fileTreeContainer: host });
      await flushDom();

      const rootElement = host.shadowRoot?.querySelector(
        '[data-file-tree-virtualized-root]'
      );
      expect(rootElement?.getAttribute('role')).toBe('group');
      expect(rootElement?.getAttribute('data-file-tree-view-mode')).toBe(
        'columns'
      );
      expect(
        host.shadowRoot?.querySelectorAll('[data-file-tree-column="ancestor"]')
          .length
      ).toBe(1);
      expect(
        host.shadowRoot?.querySelector('[data-file-tree-column="preview"]')
      ).not.toBeNull();
      // Directory rows in the active pane carry the descend chevron too, so
      // row layout stays identical as panes change roles.
      expect(
        host.shadowRoot?.querySelector(
          '[data-file-tree-virtualized-scroll] [data-item-column-descend]'
        )
      ).not.toBeNull();

      fileTree.cleanUp();
    } finally {
      cleanup();
    }
  });

  test('hydrating an explorer payload with a columns client falls back to a clean columns render', async () => {
    const { cleanup, dom } = installDom();
    try {
      const preloadFileTree = await loadPreloadFileTree();
      const FileTree = await loadFileTree();
      const baseOptions = {
        id: 'pst-hydrate-columns-mismatch',
        initialExpansion: 'open',
        paths: ['README.md', 'src/index.ts', 'src/lib/utils.ts'],
        initialVisibleRowCount: 8,
      } satisfies ConstructorParameters<typeof FileTree>[0];
      const payload = preloadFileTree({
        ...baseOptions,
        viewMode: 'explorer',
      });
      const mount = dom.window.document.createElement('div');
      mount.innerHTML = serializeFileTreeSsrPayload(payload, 'dom');
      dom.window.document.body.appendChild(mount);
      const host = mount.querySelector('file-tree-container');
      if (!(host instanceof dom.window.HTMLElement)) {
        throw new Error('expected SSR host');
      }

      const fileTree = new FileTree({
        ...baseOptions,
        viewMode: 'columns',
      });
      fileTree.hydrate({ fileTreeContainer: host });
      await flushDom();

      const rootElement = host.shadowRoot?.querySelector(
        '[data-file-tree-virtualized-root]'
      );
      expect(rootElement?.getAttribute('role')).toBe('group');
      expect(rootElement?.getAttribute('data-file-tree-view-mode')).toBe(
        'columns'
      );
      expect(
        host.shadowRoot?.querySelector('[data-file-tree-columns-wrap="active"]')
      ).not.toBeNull();

      fileTree.cleanUp();
    } finally {
      cleanup();
    }
  });
});
