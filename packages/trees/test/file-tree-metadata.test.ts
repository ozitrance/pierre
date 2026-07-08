import { describe, expect, test } from 'bun:test';

import {
  applyFileTreeMetadataPatch,
  resolveFileTreeMetadataState,
} from '../src/model/metadata';
import {
  formatFileSize,
  formatMetadataColumn,
  formatModifiedTime,
} from '../src/utils/metadataPresentation';

describe('file-tree metadata state', () => {
  test('resolve keys metadata by canonical path, directories keep their slash', () => {
    const state = resolveFileTreeMetadataState([
      { path: 'src/index.ts', sizeBytes: 2048 },
      { commitMessage: 'Initial commit', path: 'src/' },
      { modifiedAt: 1_700_000_000_000, path: '/docs//guide.md' },
    ]);

    expect(state?.metadataByPath.get('src/index.ts')?.sizeBytes).toBe(2048);
    expect(state?.metadataByPath.get('src/')?.commitMessage).toBe(
      'Initial commit'
    );
    expect(state?.metadataByPath.get('docs/guide.md')?.modifiedAt).toBe(
      1_700_000_000_000
    );
  });

  test('resolve returns null for empty input', () => {
    expect(resolveFileTreeMetadataState(undefined)).toBeNull();
    expect(resolveFileTreeMetadataState([])).toBeNull();
  });

  test('directories accept sizeBytes and render through the size column', () => {
    const state = resolveFileTreeMetadataState([
      { path: 'src/', sizeBytes: 5 * 1024 * 1024 },
    ]);
    const metadata = state?.metadataByPath.get('src/') ?? null;

    expect(metadata?.sizeBytes).toBe(5 * 1024 * 1024);
    expect(
      formatMetadataColumn(
        { kind: 'size' },
        { item: { kind: 'directory', name: 'src', path: 'src/' }, metadata }
      )
    ).toBe('5.0 MB');
  });

  test('patch sets and removes entries and reports no-ops by identity', () => {
    const initial = resolveFileTreeMetadataState([
      { path: 'a.ts', sizeBytes: 10 },
      { path: 'b.ts', sizeBytes: 20 },
    ]);

    const unchanged = applyFileTreeMetadataPatch(initial, {
      set: [{ path: 'a.ts', sizeBytes: 10 }],
    });
    expect(unchanged).toBe(initial);

    const updated = applyFileTreeMetadataPatch(initial, {
      remove: ['b.ts'],
      set: [{ commitMessage: 'Tweak', path: 'a.ts', sizeBytes: 12 }],
    });
    expect(updated).not.toBe(initial);
    expect(updated?.metadataByPath.get('a.ts')).toEqual({
      commitMessage: 'Tweak',
      modifiedAt: undefined,
      sizeBytes: 12,
    });
    expect(updated?.metadataByPath.has('b.ts')).toBe(false);

    const cleared = applyFileTreeMetadataPatch(updated, {
      remove: ['a.ts'],
    });
    expect(cleared).toBeNull();
  });
});

describe('file-tree metadata presentation', () => {
  test('formatFileSize scales through binary units', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatFileSize(-1)).toBe('');
  });

  test('formatModifiedTime renders compact relative ages against a pinned clock', () => {
    const now = Date.UTC(2026, 6, 7, 12, 0, 0);
    expect(formatModifiedTime(now - 30_000, now)).toBe('30s');
    expect(formatModifiedTime(now - 5 * 60_000, now)).toBe('5m');
    expect(formatModifiedTime(now - 3 * 3_600_000, now)).toBe('3h');
    expect(formatModifiedTime(now - 2 * 86_400_000, now)).toBe('2d');
    expect(formatModifiedTime(now - 3 * 604_800_000, now)).toBe('3w');
  });

  test('formatMetadataColumn reads the field for its kind and honors custom format', () => {
    const item = { kind: 'file' as const, name: 'a.ts', path: 'a.ts' };
    const metadata = {
      commitMessage: 'Fix crash',
      modifiedAt: Date.now(),
      sizeBytes: 4096,
    };

    expect(formatMetadataColumn({ kind: 'size' }, { item, metadata })).toBe(
      '4.0 KB'
    );
    expect(formatMetadataColumn({ kind: 'message' }, { item, metadata })).toBe(
      'Fix crash'
    );
    expect(
      formatMetadataColumn({ kind: 'size' }, { item, metadata: null })
    ).toBeNull();
    expect(
      formatMetadataColumn(
        {
          format: ({ item: formatItem }) => formatItem.path.toUpperCase(),
          kind: 'size',
        },
        { item, metadata }
      )
    ).toBe('A.TS');
  });
});
