import { describe, expect, test } from 'bun:test';

import {
  computeFileTreeRowClickPlan,
  type FileTreeRowClickPlanInput,
} from '../src/render/rowClickPlan';

const baseInput: FileTreeRowClickPlanInput = {
  event: { ctrlKey: false, metaKey: false, shiftKey: false },
  isDirectory: false,
  isSearchOpen: false,
  mode: 'flow',
};

describe('computeFileTreeRowClickPlan', () => {
  test('plain click on a file selects only that path and does not toggle', () => {
    expect(computeFileTreeRowClickPlan(baseInput)).toEqual({
      closeSearch: false,
      openTarget: false,
      revealCanonical: false,
      selection: { kind: 'single' },
      toggleDirectory: false,
    });
  });

  test('plain click on a directory selects and toggles expansion', () => {
    expect(
      computeFileTreeRowClickPlan({ ...baseInput, isDirectory: true })
    ).toEqual({
      closeSearch: false,
      openTarget: false,
      revealCanonical: false,
      selection: { kind: 'single' },
      toggleDirectory: true,
    });
  });

  test('shift-click produces a range selection without toggling', () => {
    expect(
      computeFileTreeRowClickPlan({
        ...baseInput,
        event: { ctrlKey: false, metaKey: false, shiftKey: true },
        isDirectory: true,
      })
    ).toEqual({
      closeSearch: false,
      openTarget: false,
      revealCanonical: false,
      selection: { additive: false, kind: 'range' },
      toggleDirectory: false,
    });
  });

  test('shift + ctrl adds the range on top of existing selection', () => {
    expect(
      computeFileTreeRowClickPlan({
        ...baseInput,
        event: { ctrlKey: true, metaKey: false, shiftKey: true },
      })
    ).toEqual({
      closeSearch: false,
      openTarget: false,
      revealCanonical: false,
      selection: { additive: true, kind: 'range' },
      toggleDirectory: false,
    });
  });

  test('shift + meta also produces an additive range (Mac)', () => {
    const plan = computeFileTreeRowClickPlan({
      ...baseInput,
      event: { ctrlKey: false, metaKey: true, shiftKey: true },
    });
    expect(plan.selection).toEqual({ additive: true, kind: 'range' });
    expect(plan.toggleDirectory).toBe(false);
  });

  test('ctrl-click toggles the single path in the selection', () => {
    expect(
      computeFileTreeRowClickPlan({
        ...baseInput,
        event: { ctrlKey: true, metaKey: false, shiftKey: false },
        isDirectory: true,
      })
    ).toEqual({
      closeSearch: false,
      openTarget: false,
      revealCanonical: false,
      selection: { kind: 'toggle' },
      toggleDirectory: false,
    });
  });

  test('meta-click also toggles the single path (Mac)', () => {
    const plan = computeFileTreeRowClickPlan({
      ...baseInput,
      event: { ctrlKey: false, metaKey: true, shiftKey: false },
    });
    expect(plan.selection).toEqual({ kind: 'toggle' });
    expect(plan.toggleDirectory).toBe(false);
  });

  test('an open search stays open on every click', () => {
    const plain = computeFileTreeRowClickPlan({
      ...baseInput,
      isSearchOpen: true,
    });
    const shift = computeFileTreeRowClickPlan({
      ...baseInput,
      event: { ctrlKey: false, metaKey: false, shiftKey: true },
      isSearchOpen: true,
    });
    expect(plain.closeSearch).toBe(false);
    expect(shift.closeSearch).toBe(false);
  });

  test('sticky mode clicks ask the caller to reveal the canonical row', () => {
    const plan = computeFileTreeRowClickPlan({
      ...baseInput,
      isDirectory: true,
      mode: 'sticky',
    });
    expect(plan.revealCanonical).toBe(true);
    expect(plan.toggleDirectory).toBe(true);
    expect(plan.selection).toEqual({ kind: 'single' });
  });

  test('sticky modifier clicks still request canonical reveal but do not toggle', () => {
    const plan = computeFileTreeRowClickPlan({
      ...baseInput,
      event: { ctrlKey: true, metaKey: false, shiftKey: false },
      isDirectory: true,
      mode: 'sticky',
    });

    expect(plan.revealCanonical).toBe(true);
    expect(plan.toggleDirectory).toBe(false);
    expect(plan.selection).toEqual({ kind: 'toggle' });
  });

  test('flow mode clicks never request a sticky reveal', () => {
    expect(
      computeFileTreeRowClickPlan({ ...baseInput, mode: 'flow' })
        .revealCanonical
    ).toBe(false);
  });

  test('explorer single click selects without toggling or activating', () => {
    expect(
      computeFileTreeRowClickPlan({
        ...baseInput,
        event: { ctrlKey: false, detail: 1, metaKey: false, shiftKey: false },
        isDirectory: true,
        viewMode: 'explorer',
      })
    ).toEqual({
      closeSearch: false,
      openTarget: false,
      revealCanonical: false,
      selection: { kind: 'single' },
      toggleDirectory: false,
    });
  });

  test('explorer double click activates the target', () => {
    const directoryPlan = computeFileTreeRowClickPlan({
      ...baseInput,
      event: { ctrlKey: false, detail: 2, metaKey: false, shiftKey: false },
      isDirectory: true,
      viewMode: 'explorer',
    });
    const filePlan = computeFileTreeRowClickPlan({
      ...baseInput,
      event: { ctrlKey: false, detail: 2, metaKey: false, shiftKey: false },
      viewMode: 'explorer',
    });
    expect(directoryPlan.openTarget).toBe(true);
    expect(directoryPlan.toggleDirectory).toBe(false);
    expect(filePlan.openTarget).toBe(true);
  });

  test('explorer double click with a modifier never activates', () => {
    const plan = computeFileTreeRowClickPlan({
      ...baseInput,
      event: { ctrlKey: true, detail: 2, metaKey: false, shiftKey: false },
      isDirectory: true,
      viewMode: 'explorer',
    });
    expect(plan.openTarget).toBe(false);
    expect(plan.selection).toEqual({ kind: 'toggle' });
  });

  test('explorer keeps an open search filter on single click, closes on activation', () => {
    const single = computeFileTreeRowClickPlan({
      ...baseInput,
      event: { ctrlKey: false, detail: 1, metaKey: false, shiftKey: false },
      isSearchOpen: true,
      viewMode: 'explorer',
    });
    const activation = computeFileTreeRowClickPlan({
      ...baseInput,
      event: { ctrlKey: false, detail: 2, metaKey: false, shiftKey: false },
      isSearchOpen: true,
      viewMode: 'explorer',
    });
    expect(single.closeSearch).toBe(false);
    expect(activation.closeSearch).toBe(true);
  });

  test('columns mode active-pane clicks follow explorer semantics', () => {
    const single = computeFileTreeRowClickPlan({
      ...baseInput,
      event: { ctrlKey: false, detail: 1, metaKey: false, shiftKey: false },
      isDirectory: true,
      viewMode: 'columns',
    });
    const activation = computeFileTreeRowClickPlan({
      ...baseInput,
      event: { ctrlKey: false, detail: 2, metaKey: false, shiftKey: false },
      isDirectory: true,
      viewMode: 'columns',
    });
    expect(single).toEqual({
      closeSearch: false,
      openTarget: false,
      revealCanonical: false,
      selection: { kind: 'single' },
      toggleDirectory: false,
    });
    expect(activation.openTarget).toBe(true);
    expect(activation.toggleDirectory).toBe(false);
  });

  test('toggleDirectory is false whenever any modifier is held, even on a directory', () => {
    const modifiers: Array<FileTreeRowClickPlanInput['event']> = [
      { ctrlKey: true, metaKey: false, shiftKey: false },
      { ctrlKey: false, metaKey: true, shiftKey: false },
      { ctrlKey: false, metaKey: false, shiftKey: true },
      { ctrlKey: true, metaKey: false, shiftKey: true },
      { ctrlKey: false, metaKey: true, shiftKey: true },
    ];
    for (const event of modifiers) {
      expect(
        computeFileTreeRowClickPlan({
          ...baseInput,
          event,
          isDirectory: true,
        }).toggleDirectory
      ).toBe(false);
    }
  });
});
