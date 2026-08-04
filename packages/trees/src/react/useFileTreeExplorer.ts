'use client';

import { useMemo } from 'react';

import type {
  FileTreeBreadcrumb,
  FileTreeViewMode,
} from '../model/publicTypes';
import type { FileTree } from '../render/FileTree';
import { useFileTreeSelector } from './useFileTreeSelector';

interface FileTreeExplorerSnapshot {
  breadcrumbs: readonly FileTreeBreadcrumb[];
  canNavigateBack: boolean;
  canNavigateUp: boolean;
  directoryPath: string;
  viewMode: FileTreeViewMode;
}

export interface FileTreeExplorerState extends FileTreeExplorerSnapshot {
  navigateBack: () => boolean;
  navigateTo: (path: string) => boolean;
  navigateUp: () => boolean;
  setViewMode: (mode: FileTreeViewMode) => void;
}

function areExplorerSnapshotsEqual(
  previous: FileTreeExplorerSnapshot,
  next: FileTreeExplorerSnapshot
): boolean {
  return (
    previous.viewMode === next.viewMode &&
    // Breadcrumbs derive from the directory path, so comparing the path
    // covers them too.
    previous.directoryPath === next.directoryPath &&
    previous.canNavigateBack === next.canNavigateBack &&
    previous.canNavigateUp === next.canNavigateUp
  );
}

/**
 * Reactive explorer-mode state (mode, current directory, breadcrumbs) plus
 * navigation callbacks, for building custom toolbars around `<FileTree />`.
 */
export function useFileTreeExplorer(model: FileTree): FileTreeExplorerState {
  const snapshot = useFileTreeSelector(
    model,
    (currentModel): FileTreeExplorerSnapshot => ({
      breadcrumbs: currentModel.getExplorerBreadcrumbs(),
      canNavigateBack: currentModel.canNavigateBack(),
      canNavigateUp: currentModel.canNavigateUp(),
      directoryPath: currentModel.getExplorerDirectoryPath(),
      viewMode: currentModel.getViewMode(),
    }),
    areExplorerSnapshotsEqual
  );

  return useMemo(
    () => ({
      ...snapshot,
      navigateBack: () => model.navigateBack(),
      navigateTo: (path: string) => model.navigateToDirectory(path),
      navigateUp: () => model.navigateUp(),
      setViewMode: (mode: FileTreeViewMode) => {
        model.setViewMode(mode);
      },
    }),
    [model, snapshot]
  );
}
