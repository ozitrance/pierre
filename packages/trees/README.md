# @pierre/trees

Path-first file tree UI for the web.

`@pierre/trees` ships one implementation through four public entry points:

- `@pierre/trees` — vanilla model, mounting API, prepared input helpers, icons,
  theming, and core types
- `@pierre/trees/react` — React hooks and `<FileTree model={...} />`
- `@pierre/trees/ssr` — preload helpers for declarative-shadow-DOM SSR
- `@pierre/trees/web-components` — custom-element registration side effect

The tree renders inside a shadow root and keeps public state keyed by canonical
path strings, not internal numeric IDs.

## Install

```bash
pnpm add @pierre/trees
```

## Vanilla usage

```ts
import { FileTree } from '@pierre/trees';

const mount = document.getElementById('mount')!;
mount.style.height = '320px';

const tree = new FileTree({
  flattenEmptyDirectories: true,
  initialExpansion: 'open',
  paths: ['README.md', 'src/index.ts', 'src/components/Button.tsx'],
  search: true,
});

tree.render({ containerWrapper: mount });
```

Common model methods include:

- `tree.add(path)`, `tree.move(fromPath, toPath)`, `tree.remove(path)`, and
  `tree.resetPaths(paths)`
- `tree.openSearch()`, `tree.setSearch(value)`, and `tree.closeSearch()`
- `tree.setGitStatus(entries)` and `tree.setIcons(config)`
- `tree.getItem(path)`, `tree.getSelectedPaths()`, `tree.getFocusedPath()`, and
  `tree.scrollToPath(path, { focus: false })`
- `tree.cleanUp()`

## Explorer mode

Next to the classic tree, `viewMode: 'explorer'` presents one directory at a
time as a flat listing, like a terminal file explorer: Enter or double-click
descends into a directory (or opens a file), the back arrow / Backspace goes up
one level, Alt+ArrowLeft walks back through the visit history, and a breadcrumb
bar above the list jumps to any ancestor. Typing filters the current directory.
The mode can be switched at runtime.

```ts
const tree = new FileTree({
  explorer: {
    onNavigate: (directoryPath) => console.log('now in', directoryPath),
    onOpenFile: (path) => openInEditor(path),
  },
  paths,
  viewMode: 'explorer',
});

tree.setViewMode('tree'); // switch back; the focused item stays revealed
tree.navigateToDirectory('src/components');
tree.navigateUp();
tree.navigateBack();
tree.getExplorerBreadcrumbs(); // [{ name: 'src', path: 'src/' }, …]
```

React callers get the same state reactively through `useFileTreeExplorer`:

```tsx
const { model } = useFileTree({ paths, viewMode: 'explorer' });
const explorer = useFileTreeExplorer(model);
// explorer.viewMode, explorer.directoryPath, explorer.breadcrumbs,
// explorer.navigateTo(path), explorer.navigateUp(), explorer.setViewMode(mode)
```

## Columns view

`viewMode: 'columns'` presents the same navigation state as explorer mode in a
Miller-column layout, like the macOS Finder columns view: one pane per directory
on the current chain, the active listing, and a preview pane for the focused
directory. ArrowRight/Enter descends, ArrowLeft steps back to the parent pane,
and a single click in any side pane reveals that item (its parent directory
becomes the active pane). Double click enters directories and opens files
through the same `explorer` callbacks.

```ts
const tree = new FileTree({ explorer, paths, viewMode: 'columns' });

tree.setViewMode('explorer'); // explorer <-> columns keeps directory & history
tree.getExplorerColumns(); // [{ directoryPath, kind, rowCount, ... }, …]
```

Because explorer and columns share their state, everything above — the
navigation methods, breadcrumbs, `explorer.initialDirectory`, and
`useFileTreeExplorer` — works unchanged in columns mode. Every pane is the same
fixed width, set by `--trees-columns-pane-width`; leftover space stays empty so
pane widths never shift as the preview pane comes and goes. Metadata columns are
not rendered in the columns view; its panes are name-focused like Finder's.
Directory rows show a descend chevron right after the name in every pane; pass
`columnsDescendAffordance: false` to drop it.

## Metadata columns

Rows can render right-aligned detail columns — file size, modified time, and a
last-commit message — from metadata keyed by path. Columns work in both view
modes and are meant for wide layouts.

```ts
const tree = new FileTree({
  columns: [{ kind: 'message' }, { kind: 'size' }, { kind: 'modified' }],
  metadata: [
    { path: 'src/index.ts', sizeBytes: 2048, modifiedAt: 1719400000000 },
    { path: 'src/', commitMessage: 'Refactor store subscriptions', sizeBytes: 52480 },
  ],
  paths,
});

tree.setMetadata(nextEntries); // full replace
tree.applyMetadataPatch({ set: [...], remove: [...] }); // incremental
```

Each column kind ships a default formatter (`formatFileSize`,
`formatModifiedTime` are also exported); pass `format` on a column to override
the cell text and `width` to override the default cell width. The CSS variables
`--trees-column-size-width`, `--trees-column-modified-width`, and
`--trees-column-message-width` adjust the lane from the host.

## Prepared input

Prepare large or frequently reloaded path lists once, then pass the prepared
result to `FileTree`.

```ts
import { FileTree, preparePresortedFileTreeInput } from '@pierre/trees';

const paths = ['src/', 'src/index.ts', 'README.md'];
const preparedInput = preparePresortedFileTreeInput(paths);

const tree = new FileTree({ preparedInput });
```

Use `prepareFileTreeInput(paths)` for raw input. Use
`preparePresortedFileTreeInput(paths)` when the final order is already known.

## React usage

```tsx
'use client';

import { FileTree, useFileTree } from '@pierre/trees/react';

export function Example({ paths }: { paths: string[] }) {
  const { model } = useFileTree({
    initialExpansion: 'open',
    paths,
    search: true,
  });

  return (
    <FileTree
      model={model}
      header={<strong>Project files</strong>}
      renderContextMenu={(item) => <div>Menu for {item.path}</div>}
      style={{ height: '320px' }}
    />
  );
}
```

`@pierre/trees/react` exports `FileTree`, `useFileTree`, `useFileTreeSearch`,
`useFileTreeSelection`, and `useFileTreeSelector`.

## SSR

```tsx
import { preloadFileTree } from '@pierre/trees/ssr';
import { FileTree, useFileTree } from '@pierre/trees/react';

const preloadedData = preloadFileTree({
  id: 'docs-tree',
  initialExpansion: 'open',
  paths: ['README.md', 'src/index.ts'],
  initialVisibleRowCount: 8,
});

export function HydratedTree() {
  const { model } = useFileTree({
    id: 'docs-tree',
    initialExpansion: 'open',
    paths: ['README.md', 'src/index.ts'],
    initialVisibleRowCount: 8,
  });

  return (
    <FileTree
      model={model}
      preloadedData={preloadedData}
      style={{ height: '240px' }}
    />
  );
}
```

`preloadFileTree()` returns `FileTreeSsrPayload`:

```ts
{
  id: string;
  outerStart: string;
  domOuterStart: string;
  shadowHtml: string;
  outerEnd: string;
}
```

Use `${payload.outerStart}${payload.shadowHtml}${payload.outerEnd}` when the
HTML parser will see the markup directly, such as a full server-rendered HTML
response. Use `${payload.domOuterStart}${payload.shadowHtml}${payload.outerEnd}`
when inserting the full container string through DOM APIs like `innerHTML` or
`dangerouslySetInnerHTML`. Pass `{ id, shadowHtml }` to the React component as
`preloadedData`.

Pass the same options to `preloadFileTree()` and the client model — including
`viewMode` when using explorer mode — so the server markup matches what the
client hydrates. If the two view modes ever drift, `hydrate()` detects the
mismatch and swaps in a fresh client render instead of adopting the stale
markup, but the pre-hydration frames still show whatever the server sent.

## Styling

The host element and shadow root read CSS variables such as:

- `--trees-selected-bg-override`
- `--trees-border-color-override`
- `--trees-fg-override`
- `--trees-theme-*`

Translate a Shiki or VS Code theme into tree CSS with `themeToTreeStyles()`:

```ts
import { themeToTreeStyles } from '@pierre/trees';

const styles = themeToTreeStyles(theme);
```

If CSS variables are not enough, `unsafeCSS` injects raw CSS into the tree
shadow root:

```ts
const tree = new FileTree({
  paths,
  unsafeCSS: `
    button[data-type='item'][data-item-selected] {
      border-radius: 999px;
    }
  `,
});
```

Treat `unsafeCSS` as an escape hatch. Start with host styles, CSS variables, and
`themeToTreeStyles()` first.

Import the web-components entry point only when you need the custom element
registration side effect:

```ts
import '@pierre/trees/web-components';
```

## Icons, git status, and composition

The root package exports icon, git-status, context-menu, drag/drop, mutation,
and row-decoration types. Public callbacks report canonical paths.

```ts
const tree = new FileTree({
  composition: {
    contextMenu: {
      enabled: true,
    },
  },
  paths,
});
```

When the context menu is enabled without an explicit `triggerMode`, it defaults
to `'right-click'`. Set `triggerMode` to `'button'` or `'both'` for the
dedicated right-side action lane. In button-capable modes, `buttonVisibility`
defaults to `'when-needed'`; set it to `'always'` to show decorative per-row
affordances while the tree still uses one floating trigger button and one
slotted menu surface.

`renderRowDecoration` owns a flexible row lane. Built-in git status uses the
next fixed lane, so custom decoration content, git status, and the context-menu
affordance can appear on the same row.

## Development

From anywhere in the repo:

```bash
moonx trees:test
moonx trees:test-e2e
moonx trees:benchmark
moonx trees:benchmark-file-tree-get-item
moonx trees:profile-file-tree
moonx trees:typecheck
moonx trees:build
```
