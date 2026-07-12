import type { FileTreeIcons, RemappedIcon } from '../iconConfig';
import type { FileTreePreparedInput } from '../preparedInput';
import type { ContextMenuAnchorRect, GitStatusEntry } from '../publicTypes';
import type { FileTreeDensity } from './density';

/**
 * Public tree identity is path-first so render and model callers never depend
 * on the underlying path-store numeric IDs.
 */
export type FileTreePublicId = string;

// The types below intentionally duplicate shapes from `@pierre/path-store`
// (PathStoreCompareEntry, PathStorePathComparator, PathStoreInitialExpansion,
// PathStoreRemoveOptions, PathStoreCollisionStrategy, PathStoreMoveOptions,
// PathStoreOperation, and the relevant PathStoreConstructorOptions fields).
//
// They are NOT re-exports. Keeping a parallel set of `FileTree*` types lets
// `@pierre/trees` present a self-contained public API: consumers never need to
// import from `@pierre/path-store` to call `controller.batch(...)`,
// `controller.move(...)`, etc. Path-store remains a runtime dependency but is
// not part of the documented surface.
//
// Trade-off: there is no compile-time link between the two. If `path-store`
// changes one of these shapes, update the matching `FileTree*` type here by
// hand. The structural equivalence is exercised in tests via the values that
// flow between the two layers.

export interface FileTreeSortEntry {
  basename: string;
  depth: number;
  isDirectory: boolean;
  path: FileTreePublicId;
  segments: readonly string[];
}

export type FileTreeSortComparator = (
  left: FileTreeSortEntry,
  right: FileTreeSortEntry
) => number;

export type FileTreeInitialExpansion = 'closed' | 'open' | number;

/**
 * How the tree presents its paths. `'tree'` is the classic expandable
 * hierarchy. `'explorer'` shows one directory at a time as a flat listing —
 * Enter or double-click descends into a directory, back/up returns to the
 * parent — like a terminal file explorer. `'columns'` is a Miller-column
 * layout over the same navigation state: the explorer listing plus one pane
 * per ancestor directory and a preview pane for the focused directory, like
 * the macOS Finder columns view. The mode can be switched at runtime with
 * `setViewMode()`.
 */
export type FileTreeViewMode = 'tree' | 'explorer' | 'columns';

/** One segment of the explorer-mode current directory, root excluded. */
export interface FileTreeBreadcrumb {
  name: string;
  path: FileTreePublicId;
}

/**
 * One pane of the columns view, left to right: `'ancestor'` panes list each
 * directory on the current chain (starting at the root), the `'active'` pane
 * is the explorer listing itself, and the optional `'preview'` pane lists the
 * children of the focused directory row.
 */
export interface FileTreeExplorerColumn {
  // Canonical directory this pane lists; '' is the root.
  directoryPath: FileTreePublicId;
  kind: 'ancestor' | 'active' | 'preview';
  // Directory basename; '' for the root pane.
  name: string;
  rowCount: number;
  // Position of the chain child inside an ancestor pane's listing (the
  // directory the next pane descends into); -1 for active/preview panes.
  selectedIndex: number;
  // Canonical path of that chain child; null for active/preview panes.
  selectedPath: FileTreePublicId | null;
}

export interface FileTreeExplorerConfig {
  // Directory the explorer starts in when the tree is constructed with
  // `viewMode: 'explorer'`. Defaults to the root ('').
  initialDirectory?: FileTreePublicId;
  // Fired after every successful explorer navigation with the new current
  // directory as a canonical path ('' for the root).
  onNavigate?: (directoryPath: FileTreePublicId) => void;
  // Fired when a file is activated in explorer mode (Enter or double-click).
  onOpenFile?: (path: FileTreePublicId) => void;
}

export interface FileTreeRemoveOptions {
  recursive?: boolean;
}

export type FileTreeCollisionStrategy = 'error' | 'replace' | 'skip';

export interface FileTreeMoveOptions {
  collision?: FileTreeCollisionStrategy;
}

export type FileTreeBatchOperation =
  | { path: FileTreePublicId; type: 'add' }
  | ({ path: FileTreePublicId; type: 'remove' } & FileTreeRemoveOptions)
  | ({
      from: FileTreePublicId;
      to: FileTreePublicId;
      type: 'move';
    } & FileTreeMoveOptions);

export interface FileTreeGitStatusPatch {
  remove?: readonly FileTreePublicId[];
  set?: readonly GitStatusEntry[];
}

// Mirrors the subset of PathStoreConstructorOptions that trees forwards to its
// underlying store. See the duplication note above the FileTree* type cluster.
interface FileTreeStoreOptions {
  flattenEmptyDirectories?: boolean;
  initialExpansion?: FileTreeInitialExpansion;
  initialExpandedPaths?: readonly FileTreePublicId[];
  presorted?: boolean;
  sort?: 'default' | FileTreeSortComparator;
}

type FileTreeInputOptions =
  | {
      paths: readonly FileTreePublicId[];
      preparedInput?: FileTreePreparedInput;
    }
  | {
      paths?: readonly FileTreePublicId[];
      preparedInput: FileTreePreparedInput;
    };

type FileTreeControllerBehaviorOptions = FileTreeStoreOptions & {
  dragAndDrop?: boolean | FileTreeDragAndDropConfig;
  explorer?: FileTreeExplorerConfig;
  fileTreeSearchMode?: FileTreeSearchMode;
  initialSearchQuery?: string | null;
  initialSelectedPaths?: readonly FileTreePublicId[];
  onSearchChange?: FileTreeSearchChangeListener;
  renaming?: boolean | FileTreeRenamingConfig;
  viewMode?: FileTreeViewMode;
};

export type FileTreeControllerOptions = FileTreeControllerBehaviorOptions &
  FileTreeInputOptions;

export interface FileTreeVisibleSegment {
  isTerminal: boolean;
  name: string;
  path: FileTreePublicId;
}

export interface FileTreeVisibleRow {
  ancestorPaths: readonly FileTreePublicId[];
  depth: number;
  flattenedSegments?: readonly FileTreeVisibleSegment[];
  hasChildren: boolean;
  index: number;
  isFocused: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  isFlattened: boolean;
  kind: 'directory' | 'file';
  level: number;
  name: string;
  path: FileTreePublicId;
  posInSet: number;
  setSize: number;
}

export interface FileTreeItemHandleBase {
  deselect(): void;
  focus(): void;
  getPath(): FileTreePublicId;
  isFocused(): boolean;
  isDirectory(): boolean;
  isSelected(): boolean;
  select(): void;
  toggleSelect(): void;
}

export interface FileTreeDirectoryHandle extends FileTreeItemHandleBase {
  collapse(): void;
  expand(): void;
  isDirectory(): true;
  isExpanded(): boolean;
  toggle(): void;
}

export interface FileTreeFileHandle extends FileTreeItemHandleBase {
  isDirectory(): false;
}

export type FileTreeItemHandle = FileTreeDirectoryHandle | FileTreeFileHandle;

export interface FileTreeRenderOptions {
  // Whether columns-view directory rows render a trailing chevron next to
  // their name pointing at the next pane. Only read in 'columns' view mode.
  // Defaults to true.
  columnsDescendAffordance?: boolean;
  // Hint how many rows should fit in the first render before the browser can
  // measure the real scroll viewport. Fractional values are allowed when the
  // desired first-render budget is not an exact multiple of itemHeight.
  initialVisibleRowCount?: number;
  itemHeight?: number;
  overscan?: number;
  stickyFolders?: boolean;
}

export type FileTreeScrollOffset = 'top' | 'center' | 'nearest';

export interface FileTreeScrollToPathOptions {
  focus?: boolean;
  offset?: FileTreeScrollOffset;
}

export type FileTreeSearchMode =
  | 'expand-matches'
  | 'collapse-non-matches'
  | 'hide-non-matches';

// Controls what happens to the search session when the search input loses
// focus. `'close'` (the default, and the legacy behavior) clears the query and
// closes the search session as soon as the input is blurred. `'retain'` keeps
// the current query and leaves the session open, so the filter stays applied
// until the caller explicitly closes it (via Escape, Enter, or a programmatic
// `closeSearch()`). `'retain'` is useful for trees mounted with an
// `initialSearchQuery` that should survive concurrent siblings stealing focus
// during mount.
export type FileTreeSearchBlurBehavior = 'close' | 'retain';

export type FileTreeSearchChangeListener = (value: string | null) => void;

export interface FileTreeSearchSessionHandle {
  closeSearch(): void;
  focusNextSearchMatch(): void;
  focusPreviousSearchMatch(): void;
  getSearchMatchingPaths(): readonly FileTreePublicId[];
  getSearchValue(): string;
  isSearchOpen(): boolean;
  openSearch(initialValue?: string): void;
  setSearch(value: string | null): void;
}

export interface FileTreeDropTarget {
  directoryPath: FileTreePublicId | null;
  flattenedSegmentPath: FileTreePublicId | null;
  hoveredPath: FileTreePublicId | null;
  kind: 'directory' | 'root';
}

export interface FileTreeDropContext {
  draggedPaths: readonly FileTreePublicId[];
  target: FileTreeDropTarget;
}

export interface FileTreeDropResult extends FileTreeDropContext {
  operation: 'batch' | 'move';
}

export interface FileTreeDragAndDropConfig {
  canDrag?: (paths: readonly FileTreePublicId[]) => boolean;
  canDrop?: (event: FileTreeDropContext) => boolean;
  onDropComplete?: (event: FileTreeDropResult) => void;
  onDropError?: (error: string, event: FileTreeDropContext) => void;
  openOnDropDelay?: number;
}

export interface FileTreeRenamingItem {
  isFolder: boolean;
  path: FileTreePublicId;
}

export interface FileTreeRenameEvent {
  destinationPath: FileTreePublicId;
  isFolder: boolean;
  sourcePath: FileTreePublicId;
}

export interface FileTreeRenamingConfig {
  canRename?: (item: FileTreeRenamingItem) => boolean;
  onError?: (error: string) => void;
  onRename?: (event: FileTreeRenameEvent) => void;
}

type FileTreeOptionSurface = FileTreeRenderOptions & {
  columns?: readonly FileTreeColumn[];
  composition?: FileTreeCompositionOptions;
  density?: FileTreeDensity;
  gitStatus?: readonly GitStatusEntry[];
  id?: string;
  icons?: FileTreeIcons;
  metadata?: readonly FileTreeMetadataEntry[];
  onSelectionChange?: FileTreeSelectionChangeListener;
  renderRowDecoration?: FileTreeRowDecorationRenderer;
  search?: boolean;
  // When `true`, renders the search input with a synthetic focus ring so the
  // input looks focused even though no browser focus is attached. The ring is
  // dismissed automatically on the first real interaction with the input
  // (focus, pointer down, or input). Intended for demos and marketing pages
  // that pre-populate an `initialSearchQuery` and want the visual to match a
  // focused state without stealing real focus from siblings.
  searchFakeFocus?: boolean;
  searchBlurBehavior?: FileTreeSearchBlurBehavior;
  unsafeCSS?: string;
};

export type FileTreeOptions = FileTreeControllerOptions & FileTreeOptionSurface;

export interface FileTreeRenderProps {
  containerWrapper?: HTMLElement;
  fileTreeContainer?: HTMLElement;
}

export interface FileTreeHydrationProps {
  fileTreeContainer: HTMLElement;
}

export interface FileTreeSsrPayload {
  domOuterStart: string;
  id: string;
  outerEnd: string;
  outerStart: string;
  shadowHtml: string;
}

export interface FileTreeMutationEventInvalidation {
  canonicalChanged: boolean;
  projectionChanged: boolean;
  visibleCountDelta: number | null;
}

export interface FileTreeAddEvent extends FileTreeMutationEventInvalidation {
  operation: 'add';
  path: FileTreePublicId;
}

export interface FileTreeRemoveEvent extends FileTreeMutationEventInvalidation {
  operation: 'remove';
  path: FileTreePublicId;
  recursive: boolean;
}

export interface FileTreeMoveEvent extends FileTreeMutationEventInvalidation {
  from: FileTreePublicId;
  operation: 'move';
  to: FileTreePublicId;
}

export interface FileTreeResetEvent extends FileTreeMutationEventInvalidation {
  operation: 'reset';
  pathCountAfter: number;
  pathCountBefore: number;
  usedPreparedInput: boolean;
}

export type FileTreeMutationSemanticEvent =
  | FileTreeAddEvent
  | FileTreeRemoveEvent
  | FileTreeMoveEvent
  | FileTreeResetEvent;

export interface FileTreeBatchEvent extends FileTreeMutationEventInvalidation {
  events: readonly FileTreeMutationSemanticEvent[];
  operation: 'batch';
}

export type FileTreeMutationEvent =
  | FileTreeMutationSemanticEvent
  | FileTreeBatchEvent;

export type FileTreeMutationEventType = FileTreeMutationEvent['operation'];

export type FileTreeMutationEventForType<
  TType extends FileTreeMutationEventType | '*',
> = TType extends '*'
  ? FileTreeMutationEvent
  : Extract<FileTreeMutationEvent, { operation: TType }>;

interface FileTreeResetBehaviorOptions {
  // When provided, replaces the baseline expansion set stored at construction
  // time. Useful when the caller is swapping in a dramatically different path
  // list (e.g. upgrading from an SSR preview to a full dataset) and wants the
  // fresh store to start with expansion state that reflects the new paths.
  initialExpandedPaths?: readonly FileTreePublicId[];
}

export type FileTreeResetOptions = FileTreeResetBehaviorOptions & {
  // When omitted, the raw `paths` argument describes the tree. When provided,
  // it must describe the same path list passed to resetPaths(paths, ...).
  preparedInput?: FileTreePreparedInput;
};

// Options shape for the preparedInput-only `resetPaths` overload. `paths` may be
// omitted entirely because `preparedInput` already carries the canonical path
// list, so the runtime skips the parse + sort that raw `paths` would require.
export type FileTreeResetPreparedOptions = FileTreeResetBehaviorOptions & {
  preparedInput: FileTreePreparedInput;
};

export interface FileTreeMutationHandle {
  add(path: FileTreePublicId): void;
  batch(operations: readonly FileTreeBatchOperation[]): void;
  move(
    fromPath: FileTreePublicId,
    toPath: FileTreePublicId,
    options?: FileTreeMoveOptions
  ): void;
  onMutation<TType extends FileTreeMutationEventType | '*'>(
    type: TType,
    handler: (event: FileTreeMutationEventForType<TType>) => void
  ): () => void;
  remove(path: FileTreePublicId, options?: FileTreeRemoveOptions): void;
  // Exactly one of `paths` or `preparedInput` is required. Pass raw `paths`
  // (optionally with a matching `preparedInput`), or pass `preparedInput`
  // alone to skip the parse + sort that raw `paths` would otherwise require.
  resetPaths(
    paths: readonly FileTreePublicId[],
    options?: FileTreeResetOptions
  ): void;
  resetPaths(options: FileTreeResetPreparedOptions): void;
}

export type FileTreeListener = () => void;

export type FileTreeSelectionChangeListener = (
  selectedPaths: readonly FileTreePublicId[]
) => void;

export interface FileTreeContextMenuItem {
  kind: 'directory' | 'file';
  name: string;
  path: FileTreePublicId;
}

export interface FileTreeContextMenuOpenContext {
  anchorElement: HTMLElement;
  anchorRect: ContextMenuAnchorRect;
  /**
   * Closes the current context menu. Pass `{ restoreFocus: false }` when the
   * caller is about to transfer focus into another owned surface, such as the
   * inline rename input, so the menu close path does not steal focus back to
   * the row first.
   */
  close: (options?: { restoreFocus?: boolean }) => void;
  restoreFocus: () => void;
}

export interface FileTreeHeaderCompositionOptions {
  html?: string;
  render?: () => HTMLElement | null;
}

export type FileTreeContextMenuTriggerMode = 'both' | 'button' | 'right-click';
export type FileTreeContextMenuButtonVisibility = 'always' | 'when-needed';

export interface FileTreeContextMenuCompositionOptions {
  enabled?: boolean;
  triggerMode?: FileTreeContextMenuTriggerMode;
  buttonVisibility?: FileTreeContextMenuButtonVisibility;
  onOpen?: (
    item: FileTreeContextMenuItem,
    context: FileTreeContextMenuOpenContext
  ) => void;
  onClose?: () => void;
  /**
   * If the interactive menu surface renders through a portal instead of inside
   * the returned element, mark that portaled root with
   * `data-file-tree-context-menu-root="true"` so internal clicks are not
   * treated as outside clicks.
   */
  render?: (
    item: FileTreeContextMenuItem,
    context: FileTreeContextMenuOpenContext
  ) => HTMLElement | null;
}

export interface FileTreeCompositionOptions {
  contextMenu?: FileTreeContextMenuCompositionOptions;
  header?: FileTreeHeaderCompositionOptions;
}

export interface FileTreeRowDecorationText {
  text: string;
  title?: string;
}

export interface FileTreeRowDecorationIcon {
  icon: RemappedIcon;
  title?: string;
}

export type FileTreeRowDecoration =
  | FileTreeRowDecorationText
  | FileTreeRowDecorationIcon;

export interface FileTreeRowDecorationContext {
  item: FileTreeContextMenuItem;
  row: FileTreeVisibleRow;
}

export type FileTreeRowDecorationRenderer = (
  context: FileTreeRowDecorationContext
) => FileTreeRowDecoration | null;

/**
 * Optional per-item detail data rendered by the metadata column lane. All
 * fields are independent; provide whichever ones the configured columns read.
 */
export interface FileTreeItemMetadata {
  // Summary of the last commit that touched the item.
  commitMessage?: string;
  // Last-modified time in epoch milliseconds.
  modifiedAt?: number;
  // Size in bytes. Directories can provide one too (e.g. an aggregated
  // subtree size); the size column renders whatever is supplied.
  sizeBytes?: number;
}

export interface FileTreeMetadataEntry extends FileTreeItemMetadata {
  path: FileTreePublicId;
}

export interface FileTreeMetadataPatch {
  remove?: readonly FileTreePublicId[];
  set?: readonly FileTreeMetadataEntry[];
}

export type FileTreeColumnKind = 'message' | 'modified' | 'size';

export interface FileTreeColumnFormatContext {
  item: FileTreeContextMenuItem;
  metadata: FileTreeItemMetadata | null;
}

/**
 * One metadata column rendered on the right side of every row, in array
 * order. Each built-in kind reads one `FileTreeItemMetadata` field and ships a
 * default formatter; pass `format` to override the cell text (return null to
 * leave the cell empty).
 */
export interface FileTreeColumn {
  kind: FileTreeColumnKind;
  format?: (context: FileTreeColumnFormatContext) => string | null;
  // CSS width for the cell (e.g. '96px', '8em'). Defaults per kind.
  width?: string;
}
