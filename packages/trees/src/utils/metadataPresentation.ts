import type {
  FileTreeColumn,
  FileTreeColumnFormatContext,
} from '../model/publicTypes';

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

const RELATIVE_TIME_STEPS: readonly {
  limit: number;
  unit: string;
  size: number;
}[] = [
  { limit: 60_000, size: 1000, unit: 's' },
  { limit: 3_600_000, size: 60_000, unit: 'm' },
  { limit: 86_400_000, size: 3_600_000, unit: 'h' },
  { limit: 604_800_000, size: 86_400_000, unit: 'd' },
  { limit: 31_536_000_000, size: 604_800_000, unit: 'w' },
];

/**
 * Formats a byte count the way file managers do: whole bytes below 1 KB, one
 * decimal place afterwards ("14.2 KB", "3.1 MB").
 */
export function formatFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return '';
  }

  if (sizeBytes < 1024) {
    return `${String(Math.round(sizeBytes))} B`;
  }

  let value = sizeBytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${FILE_SIZE_UNITS[unitIndex]}`;
}

/**
 * Formats an epoch-milliseconds timestamp as a compact relative age ("12s",
 * "3h", "5d") and falls back to a short date once it is over a year old. The
 * `now` parameter exists so tests can pin the clock.
 */
export function formatModifiedTime(
  modifiedAt: number,
  now: number = Date.now()
): string {
  if (!Number.isFinite(modifiedAt)) {
    return '';
  }

  const elapsed = now - modifiedAt;
  if (elapsed < 0) {
    return formatShortDate(modifiedAt);
  }

  for (const step of RELATIVE_TIME_STEPS) {
    if (elapsed < step.limit) {
      return `${String(Math.max(1, Math.floor(elapsed / step.size)))}${step.unit}`;
    }
  }

  return formatShortDate(modifiedAt);
}

function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

/** Hover title for a timestamp cell: the full locale date and time. */
export function getModifiedTimeTitle(modifiedAt: number): string | undefined {
  const date = new Date(modifiedAt);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleString();
}

/**
 * Resolves one metadata cell's text through the column's custom formatter or
 * the built-in formatter for its kind. Returns null for an empty cell.
 */
export function formatMetadataColumn(
  column: FileTreeColumn,
  context: FileTreeColumnFormatContext
): string | null {
  if (column.format != null) {
    return column.format(context);
  }

  const metadata = context.metadata;
  if (metadata == null) {
    return null;
  }

  switch (column.kind) {
    case 'size':
      return metadata.sizeBytes == null
        ? null
        : formatFileSize(metadata.sizeBytes);
    case 'modified':
      return metadata.modifiedAt == null
        ? null
        : formatModifiedTime(metadata.modifiedAt);
    case 'message':
      return metadata.commitMessage ?? null;
  }
}

/** Hover title for a metadata cell; only timestamp cells expand their value. */
export function getMetadataColumnTitle(
  column: FileTreeColumn,
  context: FileTreeColumnFormatContext
): string | undefined {
  if (column.kind === 'modified' && context.metadata?.modifiedAt != null) {
    return getModifiedTimeTitle(context.metadata.modifiedAt);
  }

  if (column.kind === 'message') {
    return context.metadata?.commitMessage ?? undefined;
  }

  return undefined;
}
