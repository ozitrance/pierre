import type {
  FileTreeBreadcrumb,
  FileTreeSortComparator,
  FileTreeSortEntry,
} from './publicTypes';

export interface FileTreeExplorerListing {
  // Whether each directory child has at least one entry of its own. Parallel
  // to `paths`; file children are always 0.
  hasChildrenByIndex: Uint8Array;
  // Immediate children of the listed directory in display order. Directories
  // keep their canonical trailing slash.
  paths: readonly string[];
}

// Returns the first index whose entry sorts at or after `target`, assuming
// `sortedPaths` is in ascending lexicographic order.
function lowerBoundIndex(
  sortedPaths: readonly string[],
  target: string
): number {
  let low = 0;
  let high = sortedPaths.length;
  while (low < high) {
    const midpoint = (low + high) >>> 1;
    if (sortedPaths[midpoint] < target) {
      low = midpoint + 1;
    } else {
      high = midpoint;
    }
  }

  return low;
}

// Lexicographic successor of a directory prefix: the smallest string that no
// descendant of the prefix can reach. Used to binary-search the end of a
// directory's contiguous subtree run in a sorted path array.
function getPrefixSuccessor(prefix: string): string {
  return (
    prefix.slice(0, -1) +
    String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1)
  );
}

function getExplorerChildName(
  path: string,
  directoryPathLength: number
): string {
  return path.endsWith('/')
    ? path.slice(directoryPathLength, -1)
    : path.slice(directoryPathLength);
}

/**
 * Collects the immediate children of one directory from the tree's cached
 * sorted known-paths array (files plus every ancestor directory with a
 * trailing slash). Because every ancestor directory is present and sorts
 * directly before its descendants, each directory child's subtree forms a
 * contiguous run that can be skipped with one binary search — the scan is
 * O(children * log n) rather than O(n).
 */
export function collectExplorerChildren(
  sortedKnownPaths: readonly string[],
  directoryPath: string
): { hasChildren: boolean[]; paths: string[] } {
  const paths: string[] = [];
  const hasChildren: boolean[] = [];
  const prefixLength = directoryPath.length;
  const rangeEnd =
    prefixLength === 0
      ? sortedKnownPaths.length
      : lowerBoundIndex(sortedKnownPaths, getPrefixSuccessor(directoryPath));
  let index =
    prefixLength === 0 ? 0 : lowerBoundIndex(sortedKnownPaths, directoryPath);

  while (index < rangeEnd) {
    const path = sortedKnownPaths[index];
    if (path == null || path.length === prefixLength) {
      // Skip the listed directory's own entry.
      index += 1;
      continue;
    }

    const slashIndex = path.indexOf('/', prefixLength);
    if (slashIndex === -1) {
      paths.push(path);
      hasChildren.push(false);
      index += 1;
      continue;
    }

    // Known paths always contain every ancestor directory, so the first entry
    // at this level with a deeper separator is the child directory itself
    // ('dir/'). Its descendants follow contiguously; jump past them.
    const subtreeEnd = lowerBoundIndex(
      sortedKnownPaths,
      getPrefixSuccessor(path)
    );
    paths.push(path);
    hasChildren.push(subtreeEnd > index + 1);
    index = subtreeEnd;
  }

  return { hasChildren, paths };
}

function createSortEntry(
  path: string,
  directoryPath: string,
  isDirectory: boolean
): FileTreeSortEntry {
  const normalizedPath = isDirectory ? path.slice(0, -1) : path;
  const segments = normalizedPath.split('/');
  return {
    basename: segments.at(-1) ?? normalizedPath,
    depth: segments.length - 1,
    isDirectory,
    path,
    segments,
  };
}

/**
 * Orders one directory's children for display. The default order matches the
 * tree's semantics (directories first, dot-prefixed entries first within each
 * group, then case-insensitive alphabetical). A custom tree comparator is
 * honored when provided so both modes present the same ordering rules.
 */
export function sortExplorerChildren(
  listing: { hasChildren: readonly boolean[]; paths: readonly string[] },
  directoryPath: string,
  comparator: 'default' | FileTreeSortComparator | undefined
): FileTreeExplorerListing {
  const count = listing.paths.length;
  if (count <= 1) {
    return {
      hasChildrenByIndex: Uint8Array.from(listing.hasChildren, (flag) =>
        flag ? 1 : 0
      ),
      paths: [...listing.paths],
    };
  }

  const directoryPathLength = directoryPath.length;
  const order = Array.from({ length: count }, (_, index) => index);

  if (typeof comparator === 'function') {
    const sortEntries: FileTreeSortEntry[] = new Array(count);
    for (let index = 0; index < count; index += 1) {
      const path = listing.paths[index];
      sortEntries[index] = createSortEntry(
        path,
        directoryPath,
        path.endsWith('/')
      );
    }
    order.sort((left, right) =>
      comparator(sortEntries[left], sortEntries[right])
    );
  } else {
    // Decorate once so the sort comparator never re-derives names.
    const isDirectoryFlags = new Uint8Array(count);
    const isDotFlags = new Uint8Array(count);
    const lowerNames: string[] = new Array(count);
    for (let index = 0; index < count; index += 1) {
      const path = listing.paths[index];
      const isDirectory = path.endsWith('/');
      const name = getExplorerChildName(path, directoryPathLength);
      isDirectoryFlags[index] = isDirectory ? 1 : 0;
      isDotFlags[index] = name.charCodeAt(0) === 46 ? 1 : 0;
      lowerNames[index] = name.toLowerCase();
    }
    order.sort((left, right) => {
      if (isDirectoryFlags[left] !== isDirectoryFlags[right]) {
        return isDirectoryFlags[left] === 1 ? -1 : 1;
      }
      if (isDotFlags[left] !== isDotFlags[right]) {
        return isDotFlags[left] === 1 ? -1 : 1;
      }
      return lowerNames[left].localeCompare(lowerNames[right]);
    });
  }

  const sortedPaths: string[] = new Array(count);
  const hasChildrenByIndex = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) {
    const sourceIndex = order[index];
    sortedPaths[index] = listing.paths[sourceIndex];
    hasChildrenByIndex[index] = listing.hasChildren[sourceIndex] ? 1 : 0;
  }

  return { hasChildrenByIndex, paths: sortedPaths };
}

/** Splits a canonical directory path ('' or 'a/b/') into breadcrumb segments. */
export function getExplorerBreadcrumbs(
  directoryPath: string
): readonly FileTreeBreadcrumb[] {
  if (directoryPath.length === 0) {
    return [];
  }

  const segments = directoryPath.slice(0, -1).split('/');
  const breadcrumbs: FileTreeBreadcrumb[] = new Array(segments.length);
  let cumulativePath = '';
  for (let index = 0; index < segments.length; index += 1) {
    cumulativePath += `${segments[index]}/`;
    breadcrumbs[index] = { name: segments[index], path: cumulativePath };
  }

  return breadcrumbs;
}

/** Basename of an explorer listing entry relative to its listed directory. */
export function getExplorerRowName(
  path: string,
  directoryPath: string
): string {
  return getExplorerChildName(path, directoryPath.length);
}
