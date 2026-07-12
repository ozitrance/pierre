import { describe, expect, test } from 'bun:test';

import { loadFileTreeController } from './helpers/loadFileTree';

const COLUMNS_PATHS = [
  'README.md',
  'package.json',
  'src/index.ts',
  'src/app.ts',
  'src/components/Button.tsx',
  'src/components/Input.tsx',
  'src/components/fields/Checkbox.tsx',
  'src/utils/format.ts',
  'docs/guide.md',
  '.config/settings.json',
];

async function createColumnsController(
  overrides: Record<string, unknown> = {}
) {
  const FileTreeController = await loadFileTreeController();
  return new FileTreeController({
    flattenEmptyDirectories: false,
    initialExpansion: 'closed',
    paths: COLUMNS_PATHS,
    viewMode: 'columns',
    ...overrides,
  });
}

describe('file-tree columns mode', () => {
  test('at the root the panes are the active listing plus a preview of the focused directory', async () => {
    const controller = await createColumnsController();

    // Entering columns mode at the root focuses the first row ('.config').
    expect(controller.getFocusedPath()).toBe('.config/');
    const columns = controller.getExplorerColumns();
    expect(columns.map((column) => column.kind)).toEqual(['active', 'preview']);
    expect(columns[0]).toEqual({
      directoryPath: '',
      kind: 'active',
      name: '',
      rowCount: 5,
      selectedIndex: -1,
      selectedPath: null,
    });
    expect(columns[1]).toEqual({
      directoryPath: '.config/',
      kind: 'preview',
      name: '.config',
      rowCount: 1,
      selectedIndex: -1,
      selectedPath: null,
    });

    controller.destroy();
  });

  test('focusing a file drops the preview pane', async () => {
    const controller = await createColumnsController();

    controller.focusPath('README.md');
    const columns = controller.getExplorerColumns();
    expect(columns.map((column) => column.kind)).toEqual(['active']);

    controller.destroy();
  });

  test('descending builds one ancestor pane per chain directory with the chain child highlighted', async () => {
    const controller = await createColumnsController();

    controller.navigateToDirectory('src/components');
    const columns = controller.getExplorerColumns();
    expect(
      columns.map((column) => [column.kind, column.directoryPath])
    ).toEqual([
      ['ancestor', ''],
      ['ancestor', 'src/'],
      ['active', 'src/components/'],
      // Entering focuses the first row, the 'fields' directory.
      ['preview', 'src/components/fields/'],
    ]);
    const rootPane = columns[0];
    // Root listing order: .config, docs, src, package.json, README.md.
    expect(rootPane?.selectedPath).toBe('src/');
    expect(rootPane?.selectedIndex).toBe(2);
    expect(rootPane?.rowCount).toBe(5);
    const srcPane = columns[1];
    expect(srcPane?.name).toBe('src');
    expect(srcPane?.selectedPath).toBe('src/components/');
    expect(srcPane?.selectedIndex).toBe(0);

    controller.destroy();
  });

  test('getExplorerColumnRows returns windowed, sorted side-pane rows', async () => {
    const controller = await createColumnsController();

    controller.navigateToDirectory('src');
    const rootRows = controller.getExplorerColumnRows('', 0, 10);
    expect(rootRows.map((row) => row.name)).toEqual([
      '.config',
      'docs',
      'src',
      'package.json',
      'README.md',
    ]);
    expect(rootRows.map((row) => row.kind)).toEqual([
      'directory',
      'directory',
      'directory',
      'file',
      'file',
    ]);
    expect(rootRows[2]?.hasChildren).toBe(true);
    expect(rootRows[0]?.setSize).toBe(5);
    // Side panes never carry keyboard focus.
    expect(rootRows.every((row) => !row.isFocused)).toBe(true);

    const windowedRows = controller.getExplorerColumnRows('', 1, 2);
    expect(windowedRows.map((row) => row.name)).toEqual(['docs', 'src']);
    expect(windowedRows.map((row) => row.index)).toEqual([1, 2]);

    expect(controller.getExplorerColumnRows('', 4, 2)).toEqual([]);
    expect(controller.getExplorerColumnRows('README.md', 0, 5)).toEqual([]);

    controller.destroy();
  });

  test('side-pane rows report selection state', async () => {
    const controller = await createColumnsController({
      initialSelectedPaths: ['src/index.ts'],
    });

    controller.navigateToDirectory('src/components');
    const srcRows = controller.getExplorerColumnRows('src/', 0, 10);
    expect(
      srcRows.filter((row) => row.isSelected).map((row) => row.path)
    ).toEqual(['src/index.ts']);

    controller.destroy();
  });

  test('the column APIs are inert outside columns mode', async () => {
    const controller = await createColumnsController({ viewMode: 'explorer' });

    controller.navigateToDirectory('src');
    expect(controller.getExplorerColumns()).toEqual([]);
    expect(controller.getExplorerColumnRows('', 0, 10)).toEqual([]);

    controller.destroy();
  });

  test('explorer.initialDirectory seeds the chain at construction', async () => {
    const controller = await createColumnsController({
      explorer: { initialDirectory: 'src/components' },
    });

    expect(controller.getExplorerDirectoryPath()).toBe('src/components/');
    expect(
      controller.getExplorerColumns().map((column) => column.directoryPath)
    ).toEqual(['', 'src/', 'src/components/', 'src/components/fields/']);

    controller.destroy();
  });

  test('navigateUp keeps the exited directory visible as the preview pane', async () => {
    const controller = await createColumnsController();

    controller.navigateToDirectory('src/components');
    expect(controller.navigateUp()).toBe(true);
    // Focus lands on the exited directory, so its listing stays on screen as
    // the preview pane — the pane the user just left.
    expect(controller.getFocusedPath()).toBe('src/components/');
    const columns = controller.getExplorerColumns();
    expect(
      columns.map((column) => [column.kind, column.directoryPath])
    ).toEqual([
      ['ancestor', ''],
      ['active', 'src/'],
      ['preview', 'src/components/'],
    ]);

    controller.destroy();
  });

  test('search filters only the active pane', async () => {
    const controller = await createColumnsController();

    controller.navigateToDirectory('src');
    controller.setSearch('app');
    const columns = controller.getExplorerColumns();
    const activePane = columns.find((column) => column.kind === 'active');
    expect(activePane?.rowCount).toBe(1);
    expect(
      controller
        .getVisibleRows(0, controller.getVisibleCount())
        .map((row) => row.name)
    ).toEqual(['app.ts']);
    // The ancestor pane keeps its unfiltered listing.
    const rootPane = columns.find((column) => column.directoryPath === '');
    expect(rootPane?.rowCount).toBe(5);
    expect(controller.getExplorerColumnRows('', 0, 10)).toHaveLength(5);

    controller.destroy();
  });

  test('mutations refresh cached side-pane listings', async () => {
    const controller = await createColumnsController();

    controller.navigateToDirectory('src');
    expect(
      controller.getExplorerColumnRows('', 0, 10).map((row) => row.name)
    ).toEqual(['.config', 'docs', 'src', 'package.json', 'README.md']);

    controller.add('AUTHORS.md');
    expect(
      controller.getExplorerColumnRows('', 0, 10).map((row) => row.name)
    ).toEqual([
      '.config',
      'docs',
      'src',
      'AUTHORS.md',
      'package.json',
      'README.md',
    ]);

    controller.remove('src/utils/', { recursive: true });
    const rootPane = controller
      .getExplorerColumns()
      .find((column) => column.directoryPath === '');
    expect(rootPane?.selectedPath).toBe('src/');
    expect(
      controller.getExplorerColumnRows('src/', 0, 10).map((row) => row.name)
    ).toEqual(['components', 'app.ts', 'index.ts']);

    controller.destroy();
  });

  test('removing the active directory falls back to a surviving ancestor chain', async () => {
    const controller = await createColumnsController();

    controller.navigateToDirectory('src/components/fields');
    controller.remove('src/components/', { recursive: true });
    expect(controller.getExplorerDirectoryPath()).toBe('src/');
    // The fallback listing focuses its first row ('utils'), a directory, so
    // a preview pane accompanies the surviving ancestor chain.
    expect(
      controller.getExplorerColumns().map((column) => column.directoryPath)
    ).toEqual(['', 'src/', 'src/utils/']);

    controller.destroy();
  });

  test('switching between explorer and columns keeps directory, focus, and history', async () => {
    const controller = await createColumnsController({ viewMode: 'explorer' });

    controller.navigateToDirectory('src');
    controller.navigateToDirectory('src/components');
    controller.focusPath('src/components/Input.tsx');

    controller.setViewMode('columns');
    expect(controller.getViewMode()).toBe('columns');
    expect(controller.getExplorerDirectoryPath()).toBe('src/components/');
    expect(controller.getFocusedPath()).toBe('src/components/Input.tsx');
    expect(controller.canNavigateBack()).toBe(true);

    // History predating the switch still unwinds.
    expect(controller.navigateBack()).toBe(true);
    expect(controller.getExplorerDirectoryPath()).toBe('src/');

    controller.setViewMode('explorer');
    expect(controller.getExplorerDirectoryPath()).toBe('src/');
    expect(controller.getExplorerColumns()).toEqual([]);

    controller.destroy();
  });

  test('switching from tree mode lands in the focused item directory, and back restores the tree', async () => {
    const FileTreeController = await loadFileTreeController();
    const controller = new FileTreeController({
      flattenEmptyDirectories: false,
      initialExpansion: 'open',
      paths: COLUMNS_PATHS,
    });

    controller.focusPath('src/components/Button.tsx');
    controller.setViewMode('columns');
    expect(controller.getExplorerDirectoryPath()).toBe('src/components/');
    expect(controller.getFocusedPath()).toBe('src/components/Button.tsx');
    expect(
      controller.getExplorerColumns().map((column) => column.kind)
    ).toEqual(['ancestor', 'ancestor', 'active']);

    controller.setViewMode('tree');
    expect(controller.getViewMode()).toBe('tree');
    expect(controller.getFocusedPath()).toBe('src/components/Button.tsx');
    expect(controller.getExplorerColumns()).toEqual([]);

    controller.destroy();
  });

  test('openFocusedItem descends into directories and reports files in columns mode', async () => {
    const openedFiles: string[] = [];
    const controller = await createColumnsController({
      explorer: {
        onOpenFile: (path: string) => {
          openedFiles.push(path);
        },
      },
    });

    controller.focusPath('src/');
    expect(controller.openFocusedItem()).toBe(true);
    expect(controller.getExplorerDirectoryPath()).toBe('src/');

    controller.focusPath('src/app.ts');
    expect(controller.openFocusedItem()).toBe(true);
    expect(openedFiles).toEqual(['src/app.ts']);

    controller.destroy();
  });

  test('focusPath on a side-pane row reveals it: its parent becomes the active pane', async () => {
    const controller = await createColumnsController();

    controller.navigateToDirectory('src/components');
    // Simulates clicking 'docs/guide.md'-style reveal from the root pane.
    controller.focusPath('docs/');
    expect(controller.getExplorerDirectoryPath()).toBe('');
    expect(controller.getFocusedPath()).toBe('docs/');
    expect(
      controller
        .getExplorerColumns()
        .map((column) => [column.kind, column.directoryPath])
    ).toEqual([
      ['active', ''],
      ['preview', 'docs/'],
    ]);

    controller.destroy();
  });

  test('drag, sticky rows, and out-of-listing renames stay disabled in columns mode', async () => {
    const controller = await createColumnsController({
      dragAndDrop: true,
      renaming: true,
    });

    controller.navigateToDirectory('src');
    expect(controller.startDrag('src/app.ts')).toBe(false);
    expect(controller.getStickyRowCandidates(120, 28)).toEqual([]);
    // Rows outside the active listing cannot mount a rename input.
    expect(controller.startRenaming('docs/guide.md')).toBe(false);
    expect(controller.startRenaming('src/app.ts')).toBe(true);

    controller.destroy();
  });
});
