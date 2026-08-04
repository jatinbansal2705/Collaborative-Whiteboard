import type { WhiteboardElement } from '@whiteboard/shared';

/**
 * Z-order utilities (Phase 11). The elements array order is the z-order: index
 * 0 is the bottom-most layer, the last element renders on top. Every function
 * is pure and returns a new array so history snapshots stay cheap references.
 */

/** Returns the z-index of an element (0 = bottom) or -1 when absent. */
export function elementIndex(
  elements: readonly WhiteboardElement[],
  id: string,
): number {
  return elements.findIndex((element) => element.id === id);
}

/** Returns elements ordered top-most first (the layers panel display order). */
export function topmostFirst(
  elements: readonly WhiteboardElement[],
): WhiteboardElement[] {
  return [...elements].reverse();
}

/** Moves a single element to a target index (0 = bottom). */
export function moveToIndex(
  elements: readonly WhiteboardElement[],
  id: string,
  index: number,
): WhiteboardElement[] {
  const from = elementIndex(elements, id);
  if (from === -1) {
    return [...elements];
  }
  const to = Math.max(0, Math.min(elements.length - 1, index));
  if (from === to) {
    return [...elements];
  }
  const result = [...elements];
  const [element] = result.splice(from, 1);
  result.splice(to, 0, element);
  return result;
}

/**
 * Consecutive runs of selected elements (in array order). Runs move as blocks
 * so multi-selection keeps its relative order when re-ordered.
 */
function selectedRuns(
  elements: readonly WhiteboardElement[],
  selected: ReadonlySet<string>,
): number[][] {
  const runs: number[][] = [];
  let current: number[] | null = null;
  for (let i = 0; i < elements.length; i += 1) {
    if (selected.has(elements[i].id)) {
      if (current === null) {
        current = [];
      }
      current.push(i);
    } else if (current !== null) {
      runs.push(current);
      current = null;
    }
  }
  if (current !== null) {
    runs.push(current);
  }
  return runs;
}

/** Brings the selection to the top of the z-order. */
export function bringToFront(
  elements: readonly WhiteboardElement[],
  ids: readonly string[],
): WhiteboardElement[] {
  const selected = new Set(ids);
  if (selected.size === 0) {
    return [...elements];
  }
  const others = elements.filter((element) => !selected.has(element.id));
  const chosen = elements.filter((element) => selected.has(element.id));
  return [...others, ...chosen];
}

/** Sends the selection to the bottom of the z-order. */
export function sendToBack(
  elements: readonly WhiteboardElement[],
  ids: readonly string[],
): WhiteboardElement[] {
  const selected = new Set(ids);
  if (selected.size === 0) {
    return [...elements];
  }
  const others = elements.filter((element) => !selected.has(element.id));
  const chosen = elements.filter((element) => selected.has(element.id));
  return [...chosen, ...others];
}

/** Moves the selection one step forward (towards the top), block-aware. */
export function bringForward(
  elements: readonly WhiteboardElement[],
  ids: readonly string[],
): WhiteboardElement[] {
  const selected = new Set(ids);
  if (selected.size === 0) {
    return [...elements];
  }
  const result = [...elements];
  const runs = selectedRuns(result, selected);
  for (let r = runs.length - 1; r >= 0; r -= 1) {
    const run = runs[r];
    const topIndex = run[run.length - 1];
    if (topIndex + 1 >= result.length) {
      continue;
    }
    if (selected.has(result[topIndex + 1].id)) {
      continue;
    }
    const block = result.splice(run[0], run.length);
    result.splice(topIndex + 1 - run.length + 1, 0, ...block);
  }
  return result;
}

/** Moves the selection one step backward (towards the bottom), block-aware. */
export function sendBackward(
  elements: readonly WhiteboardElement[],
  ids: readonly string[],
): WhiteboardElement[] {
  const selected = new Set(ids);
  if (selected.size === 0) {
    return [...elements];
  }
  const result = [...elements];
  const runs = selectedRuns(result, selected);
  for (const run of runs) {
    const bottomIndex = run[0];
    if (bottomIndex === 0) {
      continue;
    }
    if (selected.has(result[bottomIndex - 1].id)) {
      continue;
    }
    const block = result.splice(bottomIndex, run.length);
    result.splice(bottomIndex - 1, 0, ...block);
  }
  return result;
}
