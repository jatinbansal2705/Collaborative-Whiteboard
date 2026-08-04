import type { WhiteboardElement } from '@whiteboard/shared';
import { elementsBoundingBox } from './geometry';
import type { WorldRect } from './types';

/**
 * Grouping math (Phase 11). Groups are modelled as a `groupId` on every
 * member element (ADR-0002 style structural model). All helpers are pure and
 * operate on the elements array; history snapshots stay cheap references.
 */

/** Assigns a new group id to the given elements. */
export function createGroup(
  elements: readonly WhiteboardElement[],
  ids: readonly string[],
  groupId: string,
): WhiteboardElement[] {
  const selected = new Set(ids);
  if (selected.size < 2) {
    return [...elements];
  }
  return elements.map((element) =>
    selected.has(element.id) ? { ...element, groupId } : element,
  );
}

/** Clears group membership for every element in the group. */
export function ungroupElements(
  elements: readonly WhiteboardElement[],
  groupId: string,
): WhiteboardElement[] {
  return elements.map((element) =>
    element.groupId === groupId ? { ...element, groupId: null } : element,
  );
}

/** Clears group membership for the given elements (partial ungroup). */
export function ungroupSelection(
  elements: readonly WhiteboardElement[],
  ids: readonly string[],
): WhiteboardElement[] {
  const selected = new Set(ids);
  return elements.map((element) =>
    selected.has(element.id) ? { ...element, groupId: null } : element,
  );
}

/** All members of a group, in z-order. */
export function groupMembers(
  elements: readonly WhiteboardElement[],
  groupId: string,
): WhiteboardElement[] {
  return elements.filter((element) => element.groupId === groupId);
}

/** The distinct group ids present in the document. */
export function groupIds(elements: readonly WhiteboardElement[]): string[] {
  const ids = new Set<string>();
  for (const element of elements) {
    if (element.groupId !== null) {
      ids.add(element.groupId);
    }
  }
  return [...ids];
}

/**
 * Expands a selection so every group is selected as a whole: when any member
 * is selected, all of its group siblings are added.
 */
export function expandSelectionToGroups(
  elements: readonly WhiteboardElement[],
  ids: readonly string[],
): string[] {
  const selected = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const element of elements) {
      if (element.groupId === null || !selected.has(element.id)) {
        continue;
      }
      for (const member of elements) {
        if (member.groupId === element.groupId && !selected.has(member.id)) {
          selected.add(member.id);
          changed = true;
        }
      }
    }
  }
  return [...selected];
}

/** True when the selection contains members of any group. */
export function selectionHasGroups(
  elements: readonly WhiteboardElement[],
  ids: readonly string[],
): boolean {
  const selected = new Set(ids);
  return elements.some(
    (element) => element.groupId !== null && selected.has(element.id),
  );
}

/** Union bounding box of the elements that share a group id. */
export function groupBounds(
  elements: readonly WhiteboardElement[],
  groupId: string,
): WorldRect | null {
  return elementsBoundingBox(groupMembers(elements, groupId));
}

/** The group id of an element, or null when it is ungrouped. */
export function groupIdOf(element: WhiteboardElement): string | null {
  return element.groupId;
}
