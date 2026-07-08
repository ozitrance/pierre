import { normalizeInputPath } from '../utils/normalizeInputPath';
import type {
  FileTreeItemMetadata,
  FileTreeMetadataEntry,
  FileTreeMetadataPatch,
} from './publicTypes';

export interface FileTreeMetadataState {
  readonly metadataByPath: ReadonlyMap<string, FileTreeItemMetadata>;
}

// Metadata is keyed by canonical paths (directories keep their trailing
// slash) so row rendering can join it against visible rows with one map get.
function getCanonicalMetadataPath(entryPath: string): string | null {
  const normalizedPath = normalizeInputPath(entryPath);
  if (normalizedPath == null) {
    return null;
  }

  return normalizedPath.isDirectory
    ? `${normalizedPath.path}/`
    : normalizedPath.path;
}

function areMetadataValuesEqual(
  previous: FileTreeItemMetadata | undefined,
  next: FileTreeItemMetadata
): boolean {
  return (
    previous != null &&
    previous.commitMessage === next.commitMessage &&
    previous.modifiedAt === next.modifiedAt &&
    previous.sizeBytes === next.sizeBytes
  );
}

function toItemMetadata(entry: FileTreeMetadataEntry): FileTreeItemMetadata {
  return {
    commitMessage: entry.commitMessage,
    modifiedAt: entry.modifiedAt,
    sizeBytes: entry.sizeBytes,
  };
}

export function resolveFileTreeMetadataState(
  entries: readonly FileTreeMetadataEntry[] | undefined
): FileTreeMetadataState | null {
  if (entries == null || entries.length === 0) {
    return null;
  }

  const metadataByPath = new Map<string, FileTreeItemMetadata>();
  for (const entry of entries) {
    const canonicalPath = getCanonicalMetadataPath(entry.path);
    if (canonicalPath == null) {
      continue;
    }

    metadataByPath.set(canonicalPath, toItemMetadata(entry));
  }

  return metadataByPath.size === 0 ? null : { metadataByPath };
}

/**
 * Applies an incremental metadata update, returning the previous state object
 * untouched when nothing effectively changed so mounted views can skip
 * rerenders on no-op patches.
 */
export function applyFileTreeMetadataPatch(
  previous: FileTreeMetadataState | null,
  patch: FileTreeMetadataPatch | undefined
): FileTreeMetadataState | null {
  const removeEntries = patch?.remove ?? [];
  const setEntries = patch?.set ?? [];
  if (removeEntries.length === 0 && setEntries.length === 0) {
    return previous;
  }

  const metadataByPath = new Map(previous?.metadataByPath);
  let changed = false;

  for (const path of removeEntries) {
    const canonicalPath = getCanonicalMetadataPath(path);
    if (canonicalPath != null && metadataByPath.delete(canonicalPath)) {
      changed = true;
    }
  }

  for (const entry of setEntries) {
    const canonicalPath = getCanonicalMetadataPath(entry.path);
    if (canonicalPath == null) {
      continue;
    }

    const nextMetadata = toItemMetadata(entry);
    if (
      areMetadataValuesEqual(metadataByPath.get(canonicalPath), nextMetadata)
    ) {
      continue;
    }

    metadataByPath.set(canonicalPath, nextMetadata);
    changed = true;
  }

  if (!changed) {
    return previous;
  }

  return metadataByPath.size === 0 ? null : { metadataByPath };
}
