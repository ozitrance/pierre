import type { FileTreeViewMode } from '../model/publicTypes';

export type FileTreeRowClickMode = 'flow' | 'sticky';

// A pure representation of what a mouse click on a file-tree row means. The
// input is the raw event modifiers plus a few static flags; the output is the
// set of logical operations the click should perform. Lives separately so the
// modifier-interaction table can be unit-tested without a controller or DOM.
export type FileTreeRowClickPlan = {
  selection:
    | { kind: 'range'; additive: boolean }
    | { kind: 'toggle' }
    | { kind: 'single' };
  toggleDirectory: boolean;
  // Explorer-mode activation (double click): descend into a directory or open
  // a file through the explorer callbacks.
  openTarget: boolean;
  closeSearch: boolean;
  revealCanonical: boolean;
};

export type FileTreeRowClickPlanInput = {
  event: {
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    // MouseEvent.detail: 2+ on the second click of a double click.
    detail?: number;
  };
  mode: FileTreeRowClickMode;
  isSearchOpen: boolean;
  isDirectory: boolean;
  viewMode?: FileTreeViewMode;
};

export function computeFileTreeRowClickPlan(
  input: FileTreeRowClickPlanInput
): FileTreeRowClickPlan {
  const { event, mode, isSearchOpen, isDirectory } = input;
  // The columns view keeps explorer click semantics in its active pane.
  const isExplorer =
    input.viewMode === 'explorer' || input.viewMode === 'columns';
  const additive = event.ctrlKey || event.metaKey;
  const hasModifier = event.shiftKey || additive;

  const selection: FileTreeRowClickPlan['selection'] = event.shiftKey
    ? { additive, kind: 'range' }
    : additive
      ? { kind: 'toggle' }
      : { kind: 'single' };

  // Sticky rows are aria-hidden mirrors of in-flow rows, so every sticky click
  // must hand off to the canonical row even when modifiers suppress toggling.
  // Explorer rows never expand in place: a single click selects, and only a
  // double click activates (navigate into a directory / open a file).
  return {
    // A row click does not close an open search. The user can then refine the
    // search and select results. Keep this field on the plan. It gives the
    // close decision one place to change later.
    closeSearch: isSearchOpen && (!isExplorer || (event.detail ?? 1) >= 2),
    openTarget: isExplorer && !hasModifier && (event.detail ?? 1) >= 2,
    revealCanonical: mode === 'sticky',
    selection,
    toggleDirectory: !isExplorer && !hasModifier && isDirectory,
  };
}
