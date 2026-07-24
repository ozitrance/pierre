import { describe, expect, test } from 'bun:test';

import { loadFileTreeController } from './helpers/loadFileTree';

const EXPLORER_PATHS = [
  'README.md',
  'package.json',
  'src/index.ts',
  'src/app.ts',
  'src/components/Button.tsx',
  'src/components/Input.tsx',
  'src/utils/format.ts',
  'docs/guide.md',
  '.config/settings.json',
];

async function createExplorerController(
  overrides: Record<string, unknown> = {}
) {
  const FileTreeController = await loadFileTreeController();
  return new FileTreeController({
    flattenEmptyDirectories: false,
    initialExpansion: 'closed',
    paths: EXPLORER_PATHS,
    viewMode: 'explorer',
    ...overrides,
  });
}

describe('file-tree explorer mode', () => {
  test('explorer mode lists the root directory as a flat, sorted listing', async () => {
    const controller = await createExplorerController();

    const rows = controller.getVisibleRows(0, controller.getVisibleCount());
    expect(rows.map((row) => row.name)).toEqual([
      '.config',
      'docs',
      'src',
      'package.json',
      'README.md',
    ]);
    expect(rows.map((row) => row.kind)).toEqual([
      'directory',
      'directory',
      'directory',
      'file',
      'file',
    ]);
    expect(rows.every((row) => row.level === 0)).toBe(true);
    expect(rows.every((row) => row.ancestorPaths.length === 0)).toBe(true);
    expect(rows[0]?.setSize).toBe(5);
    expect(rows[2]?.posInSet).toBe(2);
    expect(rows[2]?.hasChildren).toBe(true);

    controller.destroy();
  });

  test('navigateToDirectory descends and updates listing, breadcrumbs, and history', async () => {
    const navigations: string[] = [];
    const controller = await createExplorerController({
      explorer: {
        onNavigate: (directoryPath: string) => {
          navigations.push(directoryPath);
        },
      },
    });

    expect(controller.navigateToDirectory('src')).toBe(true);
    expect(controller.getExplorerDirectoryPath()).toBe('src/');
    expect(
      controller
        .getVisibleRows(0, controller.getVisibleCount())
        .map((row) => row.name)
    ).toEqual(['components', 'utils', 'app.ts', 'index.ts']);
    expect(controller.getExplorerBreadcrumbs()).toEqual([
      { name: 'src', path: 'src/' },
    ]);
    expect(controller.canNavigateUp()).toBe(true);
    expect(controller.canNavigateBack()).toBe(true);
    expect(navigations).toEqual(['src/']);

    expect(controller.navigateToDirectory('src/components/')).toBe(true);
    expect(controller.getExplorerBreadcrumbs()).toEqual([
      { name: 'src', path: 'src/' },
      { name: 'components', path: 'src/components/' },
    ]);
    // Entering a directory focuses its first row.
    expect(controller.getFocusedPath()).toBe('src/components/Button.tsx');

    controller.destroy();
  });

  test('navigateUp moves to the parent and focuses the exited directory', async () => {
    const controller = await createExplorerController();

    controller.navigateToDirectory('src/components');
    expect(controller.navigateUp()).toBe(true);
    expect(controller.getExplorerDirectoryPath()).toBe('src/');
    expect(controller.getFocusedPath()).toBe('src/components/');

    expect(controller.navigateUp()).toBe(true);
    expect(controller.getExplorerDirectoryPath()).toBe('');
    expect(controller.getFocusedPath()).toBe('src/');

    // The root has no parent.
    expect(controller.navigateUp()).toBe(false);
    expect(controller.canNavigateUp()).toBe(false);

    controller.destroy();
  });

  test('navigateBack returns through the visit history', async () => {
    const controller = await createExplorerController();

    controller.navigateToDirectory('src');
    controller.navigateToDirectory('docs');
    expect(controller.navigateBack()).toBe(true);
    expect(controller.getExplorerDirectoryPath()).toBe('src/');
    expect(controller.navigateBack()).toBe(true);
    expect(controller.getExplorerDirectoryPath()).toBe('');
    expect(controller.navigateBack()).toBe(false);

    controller.destroy();
  });

  test('openFocusedItem descends into directories and reports files', async () => {
    const openedFiles: string[] = [];
    const controller = await createExplorerController({
      explorer: {
        onOpenFile: (path: string) => {
          openedFiles.push(path);
        },
      },
    });

    controller.focusPath('src/');
    expect(controller.openFocusedItem()).toBe(true);
    expect(controller.getExplorerDirectoryPath()).toBe('src/');
    expect(openedFiles).toEqual([]);

    controller.focusPath('src/app.ts');
    expect(controller.openFocusedItem()).toBe(true);
    expect(controller.getExplorerDirectoryPath()).toBe('src/');
    expect(openedFiles).toEqual(['src/app.ts']);

    controller.destroy();
  });

  test('search filters the current listing by name and clears on navigation', async () => {
    const controller = await createExplorerController();

    controller.navigateToDirectory('src');
    controller.setSearch('.ts');
    expect(
      controller
        .getVisibleRows(0, controller.getVisibleCount())
        .map((row) => row.name)
    ).toEqual(['app.ts', 'index.ts']);
    expect(controller.getSearchMatchingPaths()).toEqual([
      'src/app.ts',
      'src/index.ts',
    ]);

    controller.navigateUp();
    expect(controller.isSearchOpen()).toBe(false);
    expect(controller.getVisibleCount()).toBe(5);

    controller.destroy();
  });

  test('switching modes preserves focus context both ways', async () => {
    const FileTreeController = await loadFileTreeController();
    const controller = new FileTreeController({
      flattenEmptyDirectories: false,
      initialExpansion: 'open',
      paths: EXPLORER_PATHS,
    });

    expect(controller.getViewMode()).toBe('tree');
    controller.focusPath('src/components/Button.tsx');
    controller.setViewMode('explorer');

    // Explorer opens in the focused item's directory with the item focused.
    expect(controller.getExplorerDirectoryPath()).toBe('src/components/');
    expect(controller.getFocusedPath()).toBe('src/components/Button.tsx');

    controller.setViewMode('tree');
    expect(controller.getViewMode()).toBe('tree');
    // The focused row stays visible (ancestors expanded) after the switch.
    expect(controller.getFocusedPath()).toBe('src/components/Button.tsx');
    expect(controller.getFocusedIndex()).toBeGreaterThanOrEqual(0);

    controller.destroy();
  });

  test('explorer honors the initialDirectory option', async () => {
    const controller = await createExplorerController({
      explorer: { initialDirectory: 'src/utils' },
    });

    expect(controller.getExplorerDirectoryPath()).toBe('src/utils/');
    expect(
      controller
        .getVisibleRows(0, controller.getVisibleCount())
        .map((row) => row.path)
    ).toEqual(['src/utils/format.ts']);

    controller.destroy();
  });

  test('mutations update the listing and removing the current directory walks up', async () => {
    const controller = await createExplorerController();

    controller.navigateToDirectory('src/utils');
    controller.add('src/utils/parse.ts');
    expect(
      controller
        .getVisibleRows(0, controller.getVisibleCount())
        .map((row) => row.name)
    ).toEqual(['format.ts', 'parse.ts']);

    controller.remove('src/utils/', { recursive: true });
    expect(controller.getExplorerDirectoryPath()).toBe('src/');
    expect(
      controller
        .getVisibleRows(0, controller.getVisibleCount())
        .map((row) => row.name)
    ).toEqual(['components', 'app.ts', 'index.ts']);

    controller.destroy();
  });

  test('moving the current directory keeps the explorer inside it', async () => {
    const controller = await createExplorerController();

    controller.navigateToDirectory('src/components');
    controller.move('src/components/', 'src/widgets/');
    expect(controller.getExplorerDirectoryPath()).toBe('src/widgets/');
    expect(
      controller
        .getVisibleRows(0, controller.getVisibleCount())
        .map((row) => row.path)
    ).toEqual(['src/widgets/Button.tsx', 'src/widgets/Input.tsx']);

    controller.destroy();
  });

  test('selection ranges and focus movement operate on the flat listing', async () => {
    const controller = await createExplorerController();

    controller.focusFirstItem();
    expect(controller.getFocusedPath()).toBe('.config/');
    controller.focusLastItem();
    expect(controller.getFocusedPath()).toBe('README.md');

    controller.selectOnlyPath('docs/');
    controller.selectPathRange('package.json', false);
    expect([...controller.getSelectedPaths()].sort()).toEqual([
      'docs/',
      'package.json',
      'src/',
    ]);

    controller.destroy();
  });

  test('sticky candidates and drag sessions are inert in explorer mode', async () => {
    const controller = await createExplorerController({ dragAndDrop: true });

    expect(controller.getStickyRowCandidates(100, 24)).toEqual([]);
    expect(controller.startDrag('README.md')).toBe(false);

    controller.destroy();
  });

  test('scrollToPath navigates to the target directory when needed', async () => {
    const controller = await createExplorerController();

    controller.scrollToPath('src/components/Input.tsx');
    expect(controller.getExplorerDirectoryPath()).toBe('src/components/');
    expect(controller.getFocusedPath()).toBe('src/components/Input.tsx');
    expect(controller.getScrollRequest()?.visibleIndex).toBe(1);

    controller.destroy();
  });

  test('resetPaths rebuilds the listing against the new path set', async () => {
    const controller = await createExplorerController();

    controller.navigateToDirectory('src');
    controller.resetPaths(['src/main.ts', 'src/other/deep.ts', 'top.md']);
    expect(controller.getExplorerDirectoryPath()).toBe('src/');
    expect(
      controller
        .getVisibleRows(0, controller.getVisibleCount())
        .map((row) => row.name)
    ).toEqual(['other', 'main.ts']);

    controller.destroy();
  });

  test('a custom sort comparator also orders explorer listings', async () => {
    const controller = await createExplorerController({
      sort: (left: { basename: string }, right: { basename: string }): number =>
        right.basename.localeCompare(left.basename),
    });

    expect(
      controller
        .getVisibleRows(0, controller.getVisibleCount())
        .map((row) => row.name)
    ).toEqual(['src', 'README.md', 'package.json', 'docs', '.config']);

    controller.destroy();
  });
});
